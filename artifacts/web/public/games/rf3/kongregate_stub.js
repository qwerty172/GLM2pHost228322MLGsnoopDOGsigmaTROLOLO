window.kongregate = (function () {
  function noop() {}
  function noopAsync(label, value) {
    if (typeof value !== 'undefined') {
      try {
        fetch('/api/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stat: label, value: value })
        }).catch(noop);
      } catch (e) {}
    }
  }

  return {
    services: {
      connect: noop,
      addEventListener: noop,
      removeEventListener: noop,
      isGuest: function () { return true; },
      getUsername: function () { return 'Guest'; },
      getUserId: function () { return 0; }
    },
    stats: {
      submit: noopAsync
    },
    scores: {
      submit: noop
    },
    achievements: {
      setAchievement: noop
    },
    sharedContent: {
      save: noop,
      load: noop,
      loadFromId: noop
    },
    mtx: {
      purchaseItem: noop,
      requestUserItemList: noop,
      addEventListener: noop
    }
  };
})();
