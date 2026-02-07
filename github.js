let autoLoadMoreEnabled = false;
let observer = null;
let resolveDiscussionsObserver = null;
let isHidingInProgress = false;

const DOM_UPDATE_DELAY_MS = 300; // Delay between operations to allow DOM updates

function clickLoadMoreButtons() {
    const buttons = document.querySelectorAll('button.ajax-pagination-btn');

    buttons.forEach(button => {
        if (button.textContent.trim() === 'Load more…' && !button.disabled) {
            button.click();
        }
    });
}

function startAutoLoadMore() {
    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type !== 'childList' || !mutation.addedNodes || mutation.addedNodes.length === 0) {
                continue;
            }

            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }

                const element = node;

                if (typeof element.matches === 'function' && element.matches('button.ajax-pagination-btn')) {
                    const button = element;

                    if (button.textContent && button.textContent.trim() === 'Load more…' && !button.disabled) {
                        button.click();
                    }
                }

                if (typeof element.querySelectorAll === 'function') {
                    const nestedButtons = element.querySelectorAll('button.ajax-pagination-btn');

                    nestedButtons.forEach((button) => {
                        if (button.textContent && button.textContent.trim() === 'Load more…' && !button.disabled) {
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

    // Resolve all currently visible discussions - scope to resolvable thread forms to avoid comment submission buttons
    const resolveButtons = document.querySelectorAll('.js-resolvable-timeline-thread-form button[value="resolve"]');
    resolveButtons.forEach(resolveButton);

    // Set up MutationObserver to handle dynamically loaded discussions
    let timeoutId = null;
    const processedThreads = new Set();

    resolveDiscussionsObserver = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                let hasUnresolved = false;

                // Only scan added nodes for resolve buttons
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the node itself is a review thread
                        const threads = node.matches && node.matches('[data-review-thread="true"]')
                            ? [node]
                            : node.querySelectorAll ? Array.from(node.querySelectorAll('[data-review-thread="true"]')) : [];

                        threads.forEach(thread => {
                            if (!processedThreads.has(thread) && thread.getAttribute('data-resolved') !== 'true') {
                                const resolveBtn = thread.querySelector('.js-resolvable-timeline-thread-form button[value="resolve"]');
                                if (resolveBtn) {
                                    resolveBtn.click();
                                    hasUnresolved = true;

                                    // Only mark the thread as processed after confirming it was actually resolved
                                    setTimeout(() => {
                                        const isResolved = thread.getAttribute('data-resolved') === 'true';
                                        const stillHasResolveBtn = !!thread.querySelector('.js-resolvable-timeline-thread-form button[value="resolve"]');

                                        if (isResolved || !stillHasResolveBtn) {
                                            processedThreads.add(thread);
                                        }
                                    }, DOM_UPDATE_DELAY_MS);
                                }
                            }
                        });
                    }
                });

                // Reset timeout if we found and resolved new discussions
                if (hasUnresolved) {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
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

    // Stop observing after 10 seconds if no new discussions are found
    timeoutId = setTimeout(() => {
        if (resolveDiscussionsObserver) {
            resolveDiscussionsObserver.disconnect();
            resolveDiscussionsObserver = null;
        }
    }, 10000);
}

// Helper function to wait for element to appear in DOM
function waitFor(selector, scope = document, timeout = 5000) {
    return new Promise((resolve) => {
        const existingElement = scope.querySelector(selector);
        if (existingElement) {
            return resolve(existingElement);
        }

        let timeoutId;

        const observer = new MutationObserver((mutations, obs) => {
            const element = scope.querySelector(selector);
            if (element) {
                clearTimeout(timeoutId);
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(scope, {
            childList: true,
            subtree: true
        });

        timeoutId = setTimeout(() => {
            observer.disconnect();
            resolve(scope.querySelector(selector));
        }, timeout);
    });
}

function hasUnresolvedChildDiscussions(element) {
    const childDiscussions = element.querySelectorAll('[data-review-thread="true"]');
    for (let discussion of childDiscussions) {
        if (discussion !== element && discussion.getAttribute('data-resolved') !== 'true') {
            return true;
        }
    }
    return false;
}

function setAsHidden() {
    if (isHidingInProgress) {
        console.log('⏭️ Set as Hidden is already running, ignoring subsequent call.');
        return;
    }

    isHidingInProgress = true;

    const processComments = async () => {
        // Find all menu buttons using GitHub's actual selectors
        const menuButtons = document.querySelectorAll(
            '.timeline-comment-action.Link--secondary.Button--link.Button--medium.Button, summary.timeline-comment-action'
        );

        console.log(`Found ${menuButtons.length} menu buttons.`);

        for (let i = 0; i < menuButtons.length; i++) {
            const menuBtn = menuButtons[i];

            // Skip PR description (body) - cannot be hidden
            if (menuBtn.closest('.js-command-palette-pull-body')) {
                console.log(`⏭️ (${i + 1}) Skipping: PR description (cannot be hidden).`);
                continue;
            }

            // Skip threads with "Resolve conversation" - these are discussion threads
            const threadContainer = menuBtn.closest('.js-inline-comments-container');
            if (threadContainer) {
                const hasResolveForm = threadContainer.querySelector('.js-resolvable-timeline-thread-form');
                if (hasResolveForm) {
                    // Check if this thread is already resolved
                    const discussionElement = threadContainer.closest('[data-review-thread="true"]');
                    if (discussionElement && discussionElement.getAttribute('data-resolved') !== 'true') {
                        console.log(`⏭️ (${i + 1}) Skipping: unresolved discussion thread.`);
                        continue;
                    }
                    // If resolved, check for unresolved children
                    if (discussionElement && hasUnresolvedChildDiscussions(discussionElement)) {
                        console.log(`⏭️ (${i + 1}) Skipping: has unresolved child discussions.`);
                        continue;
                    }
                }
            }

            // Find container
            const container = menuBtn.closest('.timeline-comment-group') ||
                              menuBtn.closest('.js-comment-container') ||
                              menuBtn.closest('.timeline-comment');

            if (!container) {
                console.warn(`⚠️ (${i + 1}) No container found!`);
                continue;
            }

            // Skip any parent container that has unresolved child discussions
            if (hasUnresolvedChildDiscussions(container)) {
                console.log(`⏭️ (${i + 1}) Skipping: container has unresolved child discussions.`);
                continue;
            }

            console.log(`(${i + 1}/${menuButtons.length}) Clicking menu "⋯"...`);
            menuBtn.click(); // Triggers lazy loading from GitHub

            // Wait for menu to load
            const detailsMenu = menuBtn.parentElement?.querySelector('details-menu') || container.querySelector('details-menu');

            // Wait for Hide button
            const hideBtn = await waitFor(
                'button.dropdown-item.js-comment-hide-button, button[aria-label="Hide comment"]',
                detailsMenu || container,
                5000
            );

            if (hideBtn) {
                hideBtn.click();
                console.log(`   -> (${i + 1}) Clicked "Hide comment"`);

                // Wait for minimize form
                const minimizeForm = await waitFor('.js-comment-minimize, form[action*="minimize"]', container, 2000);

                if (minimizeForm) {
                    const selectEl = minimizeForm.querySelector('select[name="classifier"]');
                    if (selectEl) {
                        selectEl.value = "OUTDATED";
                        selectEl.dispatchEvent(new Event('change', { bubbles: true }));

                        await new Promise(resolve => setTimeout(resolve, 200));

                        minimizeForm.requestSubmit();
                        console.log(`   ✅ (${i + 1}) Marked as "Outdated" and saved`);

                        // Close menu
                        if (menuBtn.closest('details[open]')) {
                            menuBtn.click();
                        }
                    } else {
                        console.warn(`   ⚠️ (${i + 1}) Form exists but no select element.`);
                    }
                } else {
                    console.warn(`   ⚠️ (${i + 1}) Minimize form did not appear.`);
                }
            } else {
                console.warn(`   ⏭️ (${i + 1}) No "Hide comment" option (or timeout). Skipping.`);

                // Close menu to avoid clutter
                if (menuBtn.closest('details[open]')) {
                    menuBtn.click();
                }
            }

            // Wait between operations (rate limiting)
            await new Promise(resolve => setTimeout(resolve, DOM_UPDATE_DELAY_MS));
        }
        console.log("🏁 Finished processing.");
        isHidingInProgress = false;
    };

    processComments().catch((error) => {
        console.error('Error in setAsHidden:', error);
        isHidingInProgress = false;
    });
}

function createControlPanel() {
    if (document.getElementById('github-pr-control-panel')) {
        return;
    }

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

    // Initialize toggle state from storage
    chrome.storage.local.get(['autoLoadMoreEnabled'], (result) => {
        autoLoadMoreEnabled = result.autoLoadMoreEnabled || false;
        if (autoLoadMoreEnabled) {
            autoLoadToggle.classList.add('active');
            autoLoadToggle.setAttribute('aria-checked', 'true');
            startAutoLoadMore();
        }
    });

    // Attach event listeners
    autoLoadToggle.addEventListener('click', () => {
        autoLoadMoreEnabled = !autoLoadMoreEnabled;
        chrome.storage.local.set({ autoLoadMoreEnabled });

        if (autoLoadMoreEnabled) {
            autoLoadToggle.classList.add('active');
            autoLoadToggle.setAttribute('aria-checked', 'true');
            startAutoLoadMore();
        } else {
            autoLoadToggle.classList.remove('active');
            autoLoadToggle.setAttribute('aria-checked', 'false');
            stopAutoLoadMore();
        }
    });

    resolveAllBtn.addEventListener('click', () => {
        resolveAllDiscussions();
    });

    setHiddenBtn.addEventListener('click', () => {
        setAsHidden();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createControlPanel);
} else {
    createControlPanel();
}
