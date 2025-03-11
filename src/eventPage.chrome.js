importScripts("./content/js/browser-polyfill.min.js");
importScripts("./content/js/core.js");

async function getCurrentTab() {
    try {
        let queryOptions = { active: true, lastFocusedWindow: true };
    
        let [tab] = await chrome.tabs.query(queryOptions);
    
        return tab;
    } catch (error) {
        console.warn('Error getting current tab', error);

        return null;
    }
}

/**
 * Get settings, set the extension icon and execute the content script
 */
async function initRun(tabId, tab, evt) {
    // check if tabId is undefined
    if (tabId === undefined) {
        return;
    }

    await log(`running init from ${evt} event`);
    
    try {
        const settings = await getSettings();

        if (tab !== null) {
            log(['manifest permissions', browser.runtime.getManifest().permissions]);
            log(['host permissions', browser.runtime.getManifest().host_permissions]);   
            
            // check if the servarr instance URL has the required permissions
            var permissions = await browser.runtime.getManifest().permissions;

            for (const site of settings.sites) {
                // remove user and password from domain for urls looking like https://user:password@domain/path
                let domain = site.domain.replace(/^(https?:\/\/)(.+):(.+)@/, '$1');

                if (tab.url.includes(domain)) {
                    log(['servarr site match found: ', site]);

                    if (tab.url.indexOf(site.searchPath) === -1) {
                        continue;
                    }

                    try {
                        let permissionsRequest = {
                            permissions: permissions,
                            origins: [site.domain]
                        };

                        let contains = await browser.permissions.contains(permissionsRequest);

                        if (contains) {
                            log([`${site.domain} has permissions`, permissions]);
                        } else {
                            const granted = await browser.permissions.request(permissions);

                            if (granted) {
                                log([`permissions for ${site.domain} granted`, permissions]);
                            } else {
                                continue;
                            }
                        }
                    } catch (error) {
                        log(['error checking permissions', error]);
                    }
                }
            }
        }

        log('current tab', tabId);

        await setIcon(settings);
        await buildMenus(settings);
        await browser.scripting.executeScript({ 
            target: {
                tabId: tabId
            },
            files: [
                'content/js/browser-polyfill.min.js',
                'content/js/content_script.js'
            ] 
        });
    }
    catch(e) {
        await log(e.message, 'error');
    }
}

browser.tabs.onActivated.addListener(async function (activeInfo) {
    initRun(activeInfo.tabId, null, 'onActivated')
});

browser.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    log(['change info status', changeInfo]);

    if (changeInfo.status == 'complete') {
        initRun(tabId, tab, 'onUpdated')
    }
});

browser.runtime.onConnect.addListener(function(port) {
    switch (port.name) {
        case 'init':
            port.onMessage.addListener(async function () {
                let tab = await getCurrentTab();

                // check if tab is null or undefined
                if (tab === null || tab === undefined) {
                    return;
                }

                await initRun(tab.id, tab, 'onConnect');
            });
            break;

        case 'icon':
            port.onMessage.addListener(async function (request) {
                const settings = await getSettings();
                
                await setIcon(settings);
            });
            break;
    }
});

/**
 * Build the browser context menus
 * @param {Settings} settings 
 */
async function buildMenus(settings) {
    await browser.contextMenus.removeAll();

    // if extension is disabled or context menu option is disabled gtfo
    if (!settings.config.enabled || !settings.config.contextMenu) {
        return;
    }

    let enabledSites = settings.sites.filter(site => { return site.enabled; });

    // if no sites are enabled gtfo
    if (enabledSites.length === 0) {
        return;
    }

    // create parent menu
    browser.contextMenus.create({ "title": "Search Servarr", "id": "sonarrRadarrLidarr", "contexts": ["selection"] });

    // create child menus from enabled sites array
    for (let i = 0; i < enabledSites.length; i++) {
        browser.contextMenus.create({ "title": enabledSites[i].menuText, "parentId": "sonarrRadarrLidarr", "id": `${enabledSites[i].id}Menu`, "contexts": ["selection"] });
    }
}

/**
 * Context menu click handler
 * @param {*} info 
 * @param {*} tab 
 */
async function onClickHandler(info, tab) {
    const settings = await getSettings();

    for (let i = 0; i < settings.sites.length; i++) {
        if (info.menuItemId == (`${settings.sites[i].id}Menu`)) {
            await browser.tabs.create({
                'url': settings.sites[i].domain.replace(/\/$/, '') + settings.sites[i].searchPath + encodeURIComponent(info.selectionText).replace(/\./g, ' ')
            });
        }
    }
};

browser.contextMenus.onClicked.addListener(onClickHandler);

/**
 * set up context menu tree at install time.
 */
browser.runtime.onInstalled.addListener(async function () {
    const settings = await getSettings();

    buildMenus(settings);
});

/**
 * Set the extension icon
 * @param {Settings} settings 
 */
async function setIcon(settings) {
    let img = `content/assets/images/SonarrRadarrLidarr${(settings.config.enabled ? '' : '-faded')}16.png`;

    await browser.action.setIcon({ path: img });
};
