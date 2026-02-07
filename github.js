let autoLoadMoreEnabled = false;
let observer = null;
let resolveDiscussionsObserver = null;
let isHidingInProgress = false;

const DOM_UPDATE_DELAY_MS = 300; 

function clickLoadMoreButtons() {
    const buttons = document.querySelectorAll('button.ajax-pagination-btn');
    buttons.forEach(button => {
        if (button.textContent.trim() === 'Load more…' && !button.disabled) {
            button.click();
        }
    });
}

function startAutoLoadMore() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type !== 'childList' || !mutation.addedNodes) continue;

            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                const element = node;

                if (typeof element.matches === 'function' && element.matches('button.ajax-pagination-btn')) {
                    if (element.textContent?.trim() === 'Load more…' && !element.disabled) {
                        element.click();
                    }
                }

                if (typeof element.querySelectorAll === 'function') {
                    const nestedButtons = element.querySelectorAll('button.ajax-pagination-btn');
                    nestedButtons.forEach((button) => {
                        if (button.textContent?.trim() === 'Load more…' && !button.disabled) {
                            button.click();
                        }
                    });
                }
            });
        }
    });

    observer.observe(document.body, {childList: true, subtree: true});
    clickLoadMoreButtons();
}

function stopAutoLoadMore() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

function resolveAllDiscussions() {
    if (resolveDiscussionsObserver) {
        resolveDiscussionsObserver.disconnect();
        resolveDiscussionsObserver = null;
    }

    const resolveButton = (button) => {
        const container = button.closest('[data-review-thread="true"]');
        if (container && container.getAttribute('data-resolved') !== 'true') {
            button.click();
        }
    };

    const resolveButtons = document.querySelectorAll('.js-resolvable-timeline-thread-form button[value="resolve"]');
    resolveButtons.forEach(resolveButton);

    let timeoutId = null;
    const processedThreads = new Set();

    resolveDiscussionsObserver = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                let hasUnresolved = false;

                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const threads = node.matches && node.matches('[data-review-thread="true"]')
                            ? [node]
                            : node.querySelectorAll ? Array.from(node.querySelectorAll('[data-review-thread="true"]')) : [];

                        threads.forEach(thread => {
                            if (!processedThreads.has(thread) && thread.getAttribute('data-resolved') !== 'true') {
                                const resolveBtn = thread.querySelector('.js-resolvable-timeline-thread-form button[value="resolve"]');
                                if (resolveBtn) {
                                    resolveBtn.click();
                                    hasUnresolved = true;
                                    setTimeout(() => {
                                        if (thread.getAttribute('data-resolved') === 'true' || !thread.querySelector('.js-resolvable-timeline-thread-form button[value="resolve"]')) {
                                            processedThreads.add(thread);
                                        }
                                    }, DOM_UPDATE_DELAY_MS);
                                }
                            }
                        });
                    }
                });

                if (hasUnresolved) {
                    if (timeoutId) clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        if (resolveDiscussionsObserver) {
                            resolveDiscussionsObserver.disconnect();
                            resolveDiscussionsObserver = null;
                        }
                    }, 10000);
                }
            }
        }
    });

    resolveDiscussionsObserver.observe(document.body, {childList: true, subtree: true});

    timeoutId = setTimeout(() => {
        if (resolveDiscussionsObserver) {
            resolveDiscussionsObserver.disconnect();
            resolveDiscussionsObserver = null;
        }
    }, 10000);
}

function waitFor(selector, scope = document, timeout = 5000) {
    return new Promise((resolve) => {
        const existingElement = scope.querySelector(selector);
        if (existingElement) return resolve(existingElement);

        let timeoutId;
        const observer = new MutationObserver((mutations, obs) => {
            const element = scope.querySelector(selector);
            if (element) {
                clearTimeout(timeoutId);
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(scope, { childList: true, subtree: true });
        timeoutId = setTimeout(() => {
            observer.disconnect();
            resolve(scope.querySelector(selector));
        }, timeout);
    });
}

/**
 * SPRAWDZANIE CZY WĄTEK JEST NIEROZWIĄZANY
 */
function isThreadUnresolved(element) {
    // Szukamy formularza "Resolve" wewnątrz tego elementu
    const resolveForm = element.querySelector('.js-resolvable-timeline-thread-form');
    if (resolveForm) {
        // Jeśli formularz istnieje, sprawdzamy atrybut na kontenerze wątku
        const threadRoot = resolveForm.closest('[data-resolved]');
        if (threadRoot && threadRoot.getAttribute('data-resolved') !== 'true') {
            return true;
        }
    }
    return false;
}

function setAsHidden() {
    if (isHidingInProgress) return;
    isHidingInProgress = true;

    const processComments = async () => {
        const menuButtons = document.querySelectorAll(
            '.timeline-comment-action.Link--secondary.Button--link.Button--medium.Button, summary.timeline-comment-action'
        );

        console.log(`🔍 Found ${menuButtons.length} menu buttons.`);

        for (let i = 0; i < menuButtons.length; i++) {
            const menuBtn = menuButtons[i];

            // 1. Pomiń opis PR
            if (menuBtn.closest('.js-command-palette-pull-body')) continue;

            // 2. Znajdź precyzyjny kontener komentarza
            const commentContainer = menuBtn.closest('.timeline-comment') || menuBtn.closest('.js-comment-container');
            if (!commentContainer) continue;

            // 3. Sprawdź czy komentarz jest częścią dyskusji i czy ta dyskusja jest unresolved
            const threadRoot = commentContainer.closest('.review-thread-component, [data-review-thread="true"]');
            if (threadRoot) {
                if (isThreadUnresolved(threadRoot)) {
                    console.log(`⏭️ (${i + 1}) Skipping: Unresolved thread.`);
                    continue;
                }
            } else {
                // Dla zwykłych komentarzy (nie-review), sprawdź czy nie ma tam formularzy resolve
                if (isThreadUnresolved(commentContainer)) {
                    console.log(`⏭️ (${i + 1}) Skipping: Contains unresolved discussion.`);
                    continue;
                }
            }

            // 4. Jeśli już ukryte (zminimalizowane), pomiń
            if (commentContainer.closest('.minimized-comment')) continue;

            console.log(`Processing (${i + 1}/${menuButtons.length})...`);
            menuBtn.click(); 

            const detailsMenu = menuBtn.parentElement?.querySelector('details-menu') || 
                               commentContainer.querySelector('details-menu');

            const hideBtn = await waitFor(
                'button.dropdown-item.js-comment-hide-button, button[aria-label="Hide comment"]',
                detailsMenu || commentContainer,
                3000
            );

            if (hideBtn) {
                hideBtn.click();

                const minimizeForm = await waitFor('.js-comment-minimize, form[action*="minimize"]', commentContainer, 2000);

                if (minimizeForm) {
                    const selectEl = minimizeForm.querySelector('select[name="classifier"]');
                    if (selectEl) {
                        selectEl.value = "OUTDATED";
                        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 150));
                        minimizeForm.requestSubmit();
                        console.log(`✅ (${i + 1}) Hidden as Outdated.`);
                    }
                }
            }

            // Zamknij menu jeśli zostało otwarte
            const detailsElement = menuBtn.closest('details');
            if (detailsElement && detailsElement.hasAttribute('open')) {
                menuBtn.click();
            }

            await new Promise(resolve => setTimeout(resolve, DOM_UPDATE_DELAY_MS));
        }
        console.log("🏁 Done.");
        isHidingInProgress = false;
    };

    processComments().catch(e => {
        console.error(e);
        isHidingInProgress = false;
    });
}

function createControlPanel() {
    if (document.getElementById('github-pr-control-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'github-pr-control-panel';
    panel.innerHTML = `
        <h3>PR Discussions Control</h3>
        <div class="control-item">
            <span id="auto-load-label">Auto Load More</span>
            <button class="toggle-switch" id="auto-load-toggle" role="switch" aria-checked="false" aria-labelledby="auto-load-label"></button>
        </div>
        <div class="control-item">
            <button id="resolve-all-btn">Resolve All</button>
        </div>
        <div class="control-item">
            <button id="set-hidden-btn">Set as Hidden</button>
        </div>
    `;

    document.body.appendChild(panel);

    const autoLoadToggle = document.getElementById('auto-load-toggle');
    const resolveAllBtn = document.getElementById('resolve-all-btn');
    const setHiddenBtn = document.getElementById('set-hidden-btn');

    chrome.storage.local.get(['autoLoadMoreEnabled'], (result) => {
        autoLoadMoreEnabled = result.autoLoadMoreEnabled || false;
        if (autoLoadMoreEnabled) {
            autoLoadToggle.classList.add('active');
            autoLoadToggle.setAttribute('aria-checked', 'true');
            startAutoLoadMore();
        }
    });

    autoLoadToggle.addEventListener('click', () => {
        autoLoadMoreEnabled = !autoLoadMoreEnabled;
        chrome.storage.local.set({ autoLoadMoreEnabled });
        autoLoadToggle.classList.toggle('active', autoLoadMoreEnabled);
        autoLoadToggle.setAttribute('aria-checked', autoLoadMoreEnabled);
        autoLoadMoreEnabled ? startAutoLoadMore() : stopAutoLoadMore();
    });

    resolveAllBtn.addEventListener('click', resolveAllDiscussions);
    setHiddenBtn.addEventListener('click', setAsHidden);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createControlPanel);
} else {
    createControlPanel();
}
