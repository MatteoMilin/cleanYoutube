// Runs in the page's MAIN world (see manifest) to read YouTube's component data.
(() => {
  // Prefer web component tags over CSS classes, which are obfuscated and change often.
  const SELECTORS_TO_REMOVE = [
    'ytd-rich-shelf-renderer[is-shorts]', // Shorts shelf (home)
    'ytd-reel-shelf-renderer', // Shorts shelf (elsewhere)
    'ytd-guide-entry-renderer:has(a#endpoint[title="Shorts"])', // Shorts entry (full guide)
    'ytd-mini-guide-entry-renderer[aria-label="Shorts"]', // Shorts entry (mini guide)

    // Playables have no stable tag/attribute, so match on the "/playables" link.
    'ytd-rich-shelf-renderer:has(a[href*="/playables"])', // Playables shelf (home)
    'ytd-rich-section-renderer:has(a[href*="/playables"])', // section wrapping the shelf
    'grid-shelf-view-model:has(a[href*="/playables"])', // newer shelf component
    'ytd-guide-entry-renderer:has(a[href*="/playables"])', // Playables entry (full guide)
    'ytd-mini-guide-entry-renderer:has(a[href*="/playables"])', // Playables entry (mini guide)

    // TODO: add the "Most relevant" sort selector from youtube.com/feed/subscriptions
    // (left out for now: unstable, could break the whole sort bar).
  ];

  function cleanPage() {
    SELECTORS_TO_REMOVE.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    });
    moveWatchLater();
    showSubscriptionCount();
  }

  // Move "Watch later" from the "You" section to right under Home.
  function moveWatchLater() {
    const home = document.querySelector('ytd-guide-entry-renderer:has(a#endpoint[href="/"])');
    const watchLater = document.querySelector('ytd-guide-entry-renderer:has(a#endpoint[href="/playlist?list=WL"])');
    if (home && watchLater && home.nextElementSibling !== watchLater) {
      home.after(watchLater);
    }
  }

  // Show the subscription count next to the "Subscriptions >" header.
  // Channels under "Show more" are rendered lazily, so count from the section data, not the DOM.
  function showSubscriptionCount() {
    document.querySelectorAll('ytd-guide-section-renderer').forEach((section) => {
      const controller = section.polymerController ?? section;
      const arrow = section.querySelector('#header-entry .arrow-icon');
      if (controller.type !== 'subscriptions' || !arrow) return;

      let counter = section.querySelector('.cleanyt-sub-count');
      if (!counter) {
        counter = document.createElement('span');
        counter.className = 'cleanyt-sub-count';
        arrow.after(counter);
      }
      const count = String(countChannels(controller.data?.items));
      if (counter.textContent !== count) counter.textContent = count; // avoid re-triggering the observer
    });
  }

  function countChannels(items = []) {
    return items.reduce((total, item) => total
      + (item.guideEntryRenderer?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC') ? 1 : 0)
      + countChannels(item.guideCollapsibleSectionEntryRenderer?.sectionItems)
      + countChannels(item.guideCollapsibleEntryRenderer?.expandableItems), 0);
  }

  // YouTube is a SPA: internal navigation doesn't reload the document.
  document.addEventListener('yt-navigate-finish', cleanPage);

  // Catch lazy-loaded content (infinite scroll), debounced.
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(cleanPage, 150);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  cleanPage();
})();
