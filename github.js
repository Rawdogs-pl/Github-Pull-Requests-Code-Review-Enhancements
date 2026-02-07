let autoLoadMoreEnabled = false;
let observer = null;
let isHidingInProgress = false;
let copilotButtonObserver = null;
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

function triggerCopilotRerequest() {
    const copilotButton = document.getElementById('re-request-review-copilot-pull-request-reviewer');

    if (copilotButton) {
        copilotButton.click();
    }
}

function updateCopilotButtonState() {
    const copilotButton = document.getElementById('re-request-review-copilot-pull-request-reviewer');
    const requestButton = document.getElementById('request-copilot-review-btn');

    if (requestButton) {
        if (copilotButton && !copilotButton.disabled) {
            requestButton.disabled = false;
            requestButton.classList.remove('disabled');
        } else {
            requestButton.disabled = true;
            requestButton.classList.add('disabled');
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

    const copilotItem = document.createElement('div');
    copilotItem.className = 'control-item';
    const copilotBtn = document.createElement('button');
    copilotBtn.id = 'request-copilot-review-btn';
    copilotBtn.textContent = 'Request Copilot review';
    copilotBtn.disabled = true;
    copilotBtn.classList.add('disabled');
    copilotItem.appendChild(copilotBtn);
    panel.appendChild(copilotItem);

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
    document.getElementById('request-copilot-review-btn').addEventListener('click', triggerCopilotRerequest);

    startCopilotButtonMonitoring();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createControlPanel);
} else {
    createControlPanel();
}
