
function clickLoadMoreButtons() {
    function clickButtons() {
        const buttons = document.querySelectorAll('button.ajax-pagination-btn');

        buttons.forEach(button => {
            if (button.textContent.trim() === 'Load more…' && !button.disabled) {
                button.click();
            }
        });
    }

    function hideResolvedConversations() {
        document.querySelectorAll('details[data-resolved="true"]').forEach(element => {
            element.style.display = 'none';
        });
    }

    window.observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'subtree') {
                clickButtons();
                hideResolvedConversations();
            }
        }
    });

    window.observer.observe(document.body, {childList: true, subtree: true});

    clickButtons();
    hideResolvedConversations();
}
chrome.storage.local.get(['extensionState'], async (result) => {
    const state = result.extensionState || 'OFF';

    if (state === 'ON') {
        clickLoadMoreButtons();
    } else {
        console.log('Extension is OFF, script will not be executed.');
    }

    chrome.runtime.sendMessage({ action: 'setBadgeText', text: state });
});
