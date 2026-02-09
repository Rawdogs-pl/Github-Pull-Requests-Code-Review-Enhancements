let autoLoadMoreEnabled = false;
let observer = null;
let isHidingInProgress = false;
let copilotButtonObserver = null;
let readyForReviewObserver = null;
const DOM_UPDATE_DELAY_MS = 400;
function clickLoadMoreButtons() {
    const buttons = document.querySelectorAll('button.ajax-pagination-btn');
    buttons.forEach(button => {
        if (!button.disabled) {
            button.click();
        }
    });
}

function startAutoLoadMore() {
    if (observer) observer.disconnect();

    let debounceTimer;
    observer = new MutationObserver((mutations) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            clickLoadMoreButtons();
        }, 500);
    });

    const targetNode = document.querySelector('.js-discussion') || document.body;
    observer.observe(targetNode, { childList: true, subtree: true });
    clickLoadMoreButtons();
}

function stopAutoLoadMore() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

async function requestCopilotReview() {
    console.log("%c--- Script Start (Mode: Close Layer) ---", "color: purple; font-weight: bold;");

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const simulateFullInteraction = (el) => {
        if (!el) return;
        const events = ['mousedown', 'mouseup', 'click', 'focus', 'focusin'];
        events.forEach(evt => {
            const event = evt.includes('focus')
                ? new FocusEvent(evt, { bubbles: true, cancelable: true })
                : new MouseEvent(evt, { bubbles: true, cancelable: true, view: window });
            el.dispatchEvent(event);
        });
        if (el.focus) el.focus();
    };

    try {
        // 1. Find menu and control button
        const menuContainer = document.getElementById('reviewers-select-menu');
        if (!menuContainer) throw new Error("Element #reviewers-select-menu not found");

        // Look for the opening element (often <summary> or <button>)
        const trigger = menuContainer.querySelector('summary') || menuContainer.querySelector('button') || menuContainer;

        // 2. Open menu
        const icon = menuContainer.querySelector('svg');
        simulateFullInteraction(icon || trigger);
        console.log("1. Menu opened.");

        // 3. Focus on filter
        await wait(500);
        const filterField = document.getElementById('review-filter-field');
        if (filterField) {
            simulateFullInteraction(filterField);
            filterField.dispatchEvent(new InputEvent('input', { bubbles: true }));
            console.log("2. Filter activated.");
        }

        // 4. Wait for option and click
        const waitForElement = (className, text, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const interval = setInterval(() => {
                    const elements = document.getElementsByClassName(className);
                    const target = Array.from(elements).find(el =>
                        el.textContent.includes(text) && (el.offsetParent !== null || el.getClientRects().length > 0)
                    );
                    if (target) {
                        clearInterval(interval);
                        resolve(target);
                    } else if (Date.now() - startTime > timeout) {
                        clearInterval(interval);
                        reject(new Error("Not found: " + text));
                    }
                }, 150);
            });
        };

        const targetElement = await waitForElement('js-extended-description', 'Your AI Pair Programmer');
        simulateFullInteraction(targetElement);
        console.log("3. Option selected.");

        // --- KEY SECTION: HIDE LAYER ---
        await wait(600); // Give the page a moment to save the selection

        console.log("4. Attempting to hide layer...");

        // Method A: If it's a GitHub <details>, close it via attribute
        const detailsParent = menuContainer.closest('details');
        if (detailsParent) {
            detailsParent.removeAttribute('open');
            console.log("-> Closed via 'open' attribute.");
        }

        // Method B: Re-click trigger (toggle off)
        simulateFullInteraction(trigger);

        // Method C: Send Escape directly to filter field
        if (filterField) {
            filterField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }

        console.log("%c5. Done! Layer should disappear.", "color: green; font-weight: bold;");

    } catch (error) {
        console.error("%cError: " + error.message, "color: red;");
    }
}

function triggerCopilotRerequest() {
    const copilotButton = document.getElementById('re-request-review-copilot-pull-request-reviewer');

    if (copilotButton) {
        copilotButton.click();
    }
}

function updateCopilotButtonState() {
    const copilotButton = document.getElementById('re-request-review-copilot-pull-request-reviewer');
    const rerequestButton = document.getElementById('re-request-copilot-review-btn');

    if (rerequestButton) {
        if (copilotButton && !copilotButton.disabled) {
            rerequestButton.disabled = false;
            rerequestButton.classList.remove('disabled');
        } else {
            rerequestButton.disabled = true;
            rerequestButton.classList.add('disabled');
        }
    }
}

function startCopilotButtonMonitoring() {
    if (copilotButtonObserver) {
        copilotButtonObserver.disconnect();
    }

    updateCopilotButtonState();

    let debounceTimer;
    copilotButtonObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateCopilotButtonState();
        }, 300);
    });

    const targetNode = document.querySelector('.js-discussion-sidebar-item') || document.body;
    copilotButtonObserver.observe(targetNode, { childList: true, subtree: true });
}

function stopCopilotButtonMonitoring() {
    if (copilotButtonObserver) {
        copilotButtonObserver.disconnect();
        copilotButtonObserver = null;
    }
}

function triggerMarkAsReady() {
    const readyButton = findReadyForReviewButton();
    if (readyButton) {
        readyButton.click();
        console.log("Clicked 'Ready for review' button");
    }
}

function findReadyForReviewButton() {
    // Search for "Ready for review" button on GitHub page
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
        if (button.textContent.trim().includes('Ready for review')) {
            return button;
        }
    }
    return null;
}

function updateMarkAsReadyButtonState() {
    const readyButton = findReadyForReviewButton();
    const markAsReadyBtn = document.getElementById('mark-as-ready-btn');
    const markAsReadyItem = document.getElementById('mark-as-ready-item');

    if (markAsReadyItem) {
        if (readyButton) {
            markAsReadyItem.style.display = 'flex';
        } else {
            markAsReadyItem.style.display = 'none';
        }
    }
}

function startReadyForReviewMonitoring() {
    if (readyForReviewObserver) {
        readyForReviewObserver.disconnect();
    }

    updateMarkAsReadyButtonState();

    let debounceTimer;
    readyForReviewObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateMarkAsReadyButtonState();
        }, 300);
    });

    const targetNode = document.body;
    readyForReviewObserver.observe(targetNode, { childList: true, subtree: true });
}

function stopReadyForReviewMonitoring() {
    if (readyForReviewObserver) {
        readyForReviewObserver.disconnect();
        readyForReviewObserver = null;
    }
}
function resolveAllDiscussions() {
    // Note: Text matching may not work in all GitHub language locales.
    // We check for buttons starting with "Resolve " to cover most variations.
    const forms = document.querySelectorAll('.js-resolvable-timeline-thread-form');
    forms.forEach(form => {
        const buttons = form.querySelectorAll('button[type="submit"]');
        buttons.forEach(btn => {
            const buttonText = btn.textContent.trim().toLowerCase();
            if (buttonText === 'resolve conversation' || buttonText.startsWith('resolve ')) {
                btn.click();
            }
        });
    });
}

function isSafeToHide(menuBtn) {
    const container = menuBtn.closest('.js-timeline-progressive-focus-container');

    if (container) {
        if (container.innerText.includes('Resolve conversation')) {
            console.log("⏭️ Skipping: Active discussion found in container.");
            return false;
        }
    }

    if (menuBtn.closest('.js-command-palette-pull-body')) return false;

    return true;
}

async function setAsHidden() {
    if (isHidingInProgress) return;
    isHidingInProgress = true;

    const allButtons = document.querySelectorAll('.timeline-comment-action.Link--secondary.Button--link, summary.timeline-comment-action');

    const buttonsToProcess = Array.from(allButtons).filter(btn => {
        if (btn.closest('.minimized-comment')) return false;
        return isSafeToHide(btn);
    });

    console.log(`🔍 Identified ${buttonsToProcess.length} comments to hide.`);

    for (let i = 0; i < buttonsToProcess.length; i++) {
        const btn = buttonsToProcess[i];
        const commentBox = btn.closest('.timeline-comment, .js-comment-container');
        if (!commentBox) continue;

        console.log(`👉 Hiding ${i + 1}/${buttonsToProcess.length}`);

        btn.click();

        const hideBtn = await new Promise(res => {
            let attempts = 0;
            const check = setInterval(() => {
                const found = commentBox.querySelector('.js-comment-hide-button');
                if (found || attempts > 10) {
                    clearInterval(check);
                    res(found);
                }
                attempts++;
            }, 100);
        });

        if (hideBtn) {
            hideBtn.click();

            const form = await new Promise(res => {
                let attempts = 0;
                const check = setInterval(() => {
                    const f = commentBox.querySelector('form[action*="minimize"]');
                    if (f || attempts > 10) {
                        clearInterval(check);
                        res(f);
                    }
                    attempts++;
                }, 100);
            });

            if (form) {
                const select = form.querySelector('select[name="classifier"]');
                if (select && select.tagName === 'SELECT') {
                    const validOptions = Array.from(select.options).map(opt => opt.value);
                    if (validOptions.includes("OUTDATED")) {
                        select.value = "OUTDATED";
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 150));
                        form.requestSubmit();
                    }
                }
            }
        } else {
            const details = btn.closest('details');
            if (details && details.open) btn.click();
        }

        await new Promise(r => setTimeout(r, DOM_UPDATE_DELAY_MS));
    }

    console.log("✅ Operation complete.");
    isHidingInProgress = false;
}

function createControlPanel() {
    if (document.getElementById('github-pr-control-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'github-pr-control-panel';

    const header = document.createElement('div');
    header.className = 'panel-header';

    const title = document.createElement('h3');
    title.textContent = 'PR Discussions';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'panel-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
    });
    header.appendChild(closeBtn);

    panel.appendChild(header);

    const autoLoadItem = document.createElement('div');
    autoLoadItem.className = 'control-item';
    const autoLoadSpan = document.createElement('span');
    autoLoadSpan.textContent = 'Auto Load';
    const autoLoadToggle = document.createElement('button');
    autoLoadToggle.className = 'toggle-switch';
    autoLoadToggle.id = 'auto-load-toggle';
    autoLoadItem.appendChild(autoLoadSpan);
    autoLoadItem.appendChild(autoLoadToggle);
    panel.appendChild(autoLoadItem);

    const resolveItem = document.createElement('div');
    resolveItem.className = 'control-item';
    const resolveBtn = document.createElement('button');
    resolveBtn.id = 'resolve-all-btn';
    resolveBtn.textContent = 'Resolve All';
    resolveItem.appendChild(resolveBtn);
    panel.appendChild(resolveItem);

    const hideItem = document.createElement('div');
    hideItem.className = 'control-item';
    const hideBtn = document.createElement('button');
    hideBtn.id = 'set-hidden-btn';
    hideBtn.textContent = 'Set as Hidden';
    hideItem.appendChild(hideBtn);
    panel.appendChild(hideItem);

    const markAsReadyItem = document.createElement('div');
    markAsReadyItem.className = 'control-item';
    markAsReadyItem.id = 'mark-as-ready-item';
    markAsReadyItem.style.display = 'none';
    const markAsReadyBtn = document.createElement('button');
    markAsReadyBtn.id = 'mark-as-ready-btn';
    markAsReadyBtn.textContent = 'Mark as ready';
    markAsReadyItem.appendChild(markAsReadyBtn);
    panel.appendChild(markAsReadyItem);

    const requestCopilotItem = document.createElement('div');
    requestCopilotItem.className = 'control-item';
    const requestCopilotBtn = document.createElement('button');
    requestCopilotBtn.id = 'request-copilot-review-btn';
    requestCopilotBtn.textContent = 'Request Copilot review';
    requestCopilotItem.appendChild(requestCopilotBtn);
    panel.appendChild(requestCopilotItem);

    const rerequestCopilotItem = document.createElement('div');
    rerequestCopilotItem.className = 'control-item';
    const rerequestCopilotBtn = document.createElement('button');
    rerequestCopilotBtn.id = 're-request-copilot-review-btn';
    rerequestCopilotBtn.textContent = 'Re-request Copilot Review';
    rerequestCopilotBtn.disabled = true;
    rerequestCopilotBtn.classList.add('disabled');
    rerequestCopilotItem.appendChild(rerequestCopilotBtn);
    panel.appendChild(rerequestCopilotItem);

    document.body.appendChild(panel);

    const toggle = document.getElementById('auto-load-toggle');

    chrome.storage.local.get(['autoLoadMoreEnabled'], (res) => {
        autoLoadMoreEnabled = res.autoLoadMoreEnabled || false;
        if (autoLoadMoreEnabled) toggle.classList.add('active');
        if (autoLoadMoreEnabled) startAutoLoadMore();
    });

    toggle.addEventListener('click', () => {
        autoLoadMoreEnabled = !autoLoadMoreEnabled;
        chrome.storage.local.set({ autoLoadMoreEnabled });
        toggle.classList.toggle('active', autoLoadMoreEnabled);
        autoLoadMoreEnabled ? startAutoLoadMore() : stopAutoLoadMore();
    });

    document.getElementById('resolve-all-btn').addEventListener('click', resolveAllDiscussions);
    document.getElementById('set-hidden-btn').addEventListener('click', setAsHidden);
    document.getElementById('mark-as-ready-btn').addEventListener('click', triggerMarkAsReady);
    document.getElementById('request-copilot-review-btn').addEventListener('click', requestCopilotReview);
    document.getElementById('re-request-copilot-review-btn').addEventListener('click', triggerCopilotRerequest);

    startCopilotButtonMonitoring();
    startReadyForReviewMonitoring();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createControlPanel);
} else {
    createControlPanel();
}
