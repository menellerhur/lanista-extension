/**
 * Actions Module: "Show Winner" and "Scroll to Bottom" buttons.
 */
(function() {
  const module = {
    name: 'actions',
    render: (ctx) => {
      const scrollEnabled = ctx.settings["battle-report-scroll-bottom"];
      const winnerEnabled = ctx.settings["battle-report-show-winner"];
      if (!scrollEnabled && !winnerEnabled) return;

      if (winnerEnabled) {
        const header = document.querySelector('.content [data-slot="card-content"] h1');
        if (header && !header.closest('.ext-battle-header-wrapper')) {
          injectWinnerAction(header);
        }
      }

      if (scrollEnabled) {
        // Find the top "Tillbaka" button. Use descendant selector in case it's already wrapped.
        const backBtn = document.querySelector('.content .relative button[data-slot="button"]');
        const isBackBtn = backBtn && backBtn.textContent.trim().toLowerCase().includes('tillbaka');
        if (isBackBtn && !document.getElementById('ext-scroll-bottom')) {
          injectScrollBottomAction(backBtn);
        }
      }
    },
    cleanup: () => {
      // Cleanup Winner button
      const winnerWrapper = document.querySelector('.ext-battle-header-wrapper');
      if (winnerWrapper) {
        const h1 = winnerWrapper.querySelector('h1');
        if (h1) winnerWrapper.parentNode.insertBefore(h1, winnerWrapper);
        winnerWrapper.remove();
      }

      // Cleanup Scroll button (Unwrap to avoid deleting managed Back button)
      const scrollWrapper = document.querySelector('.ext-battle-report-top-actions');
      if (scrollWrapper) {
        const backBtn = scrollWrapper.querySelector('button[data-slot="button"]');
        if (backBtn) {
          backBtn.classList.add('mb-1');
          scrollWrapper.parentNode.insertBefore(backBtn, scrollWrapper);
        }
        scrollWrapper.remove();
      }

      clearWinnerState();
    }
  };

  function clearWinnerState() {
    document.querySelectorAll('.ext-winner-highlight').forEach(box => {
      box.classList.remove('ext-winner-highlight');
    });
  }

  function injectWinnerAction(header) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ext-battle-header-wrapper flex items-center justify-between mb-2 w-full';
    
    header.parentNode.insertBefore(wrapper, header);
    wrapper.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'ext-battle-report-actions flex gap-2';
    
    actions.innerHTML = `
      <button class="ext-battle-report-btn ext-btn-icon-only" id="ext-show-winner" title="Visa vinnare">
        <span class="ext-btn-content"><i class="fas fa-crown"></i></span>
      </button>
    `;
    wrapper.appendChild(actions);

    const btn = document.getElementById('ext-show-winner');
    btn?.addEventListener('click', () => {
      const isActive = highlightWinner();
      btn.classList.toggle('ext-active', isActive);
    });
  }

  function injectScrollBottomAction(backBtn) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ext-battle-report-top-actions flex items-center justify-between w-full pb-2 text-sm text-muted-foreground';
    
    const BTN_CLASSES = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive underline-offset-4 hover:underline py-2 has-[>svg]:px-3 h-auto px-0 text-sm text-muted-foreground';
    
    backBtn.classList.remove('mb-1');
    backBtn.parentNode.insertBefore(wrapper, backBtn);
    wrapper.appendChild(backBtn);

    const scrollBtn = document.createElement('button');
    scrollBtn.id = 'ext-scroll-bottom';
    scrollBtn.setAttribute('data-slot', 'button');
    scrollBtn.setAttribute('data-variant', 'link');
    scrollBtn.className = BTN_CLASSES;
    scrollBtn.innerHTML = 'Till botten <i class="fas fa-chevron-down"></i>';
    
    wrapper.appendChild(scrollBtn);
    scrollBtn.addEventListener('click', scrollToBottom);
  }

  function scrollToBottom() {
    const target = document.body.scrollHeight;
    const start = window.scrollY;
    const distance = target - start;
    const duration = 400;
    let startTime = null;

    function animation(currentTime) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const run = easeInOutQuad(timeElapsed, start, distance, duration);
      window.scrollTo(0, run);
      if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function easeInOutQuad(t, b, c, d) {
      t /= d / 2;
      if (t < 1) return c / 2 * t * t + b;
      t--;
      return -c / 2 * (t * (t - 2) - 1) + b;
    }
    requestAnimationFrame(animation);
  }

  function findWinner() {
    const summaries = document.querySelectorAll(".battle-text .summary, .battle-text p");
    for (const s of summaries) {
      const txt = s.textContent;
      if (txt.includes("segrande") || txt.includes("seger")) {
        if (txt.includes("Lag 1")) return 1;
        if (txt.includes("Lag 2")) return 2;
      }
    }
    const content = document.querySelector('.content')?.textContent || "";
    if (content.includes("Lag 1 går segrande")) return 1;
    if (content.includes("Lag 2 går segrande")) return 2;
    return null;
  }

  function highlightWinner() {
    const winner = findWinner();
    if (!winner) return false;

    const teamBoxes = document.querySelectorAll('.content .grid.md\\:grid-cols-2 > div.p-3');
    if (teamBoxes.length >= winner) {
      const box = teamBoxes[winner - 1];
      const isHighlighted = box.classList.contains('ext-winner-highlight');
      
      teamBoxes.forEach(b => {
          b.classList.remove('ext-winner-highlight');
          b.querySelector('.ext-winner-trophy')?.remove();
      });

      if (!isHighlighted) {
        box.classList.add('ext-winner-highlight');
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
    }
    return false;
  }

  BattleReportManager.registerModule(module);
})();
