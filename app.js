// =========================================================================
// GLOBAL DATA CONTAINERS (Must be at the top)
// =========================================================================
let characterMaster = [];
let timelineLogs = [];
let changelogs = [];
let chronologicalTimeline = [];
let expandedDrawers = new Set();

// =========================================================================
// LIVE DATABASE CONNECTION CONFIGURATION
// =========================================================================
const CHARACTER_MASTER_URL = "./characters.csv";
const TIMELINE_LOGS_URL = "./timeline.csv";
const CHANGELOG_URL = "./changelogs.csv";

// =========================================================================
// EPISODE SELECTOR GENERATOR
// =========================================================================
function populateEpisodeDropdown() {
    const selectElement = document.getElementById("episodeSelect");
    if (!selectElement) return;
    let optionsHTML = "";

    // Configuration for episode count.

    const seasonConfig = [
        { season: 1, episodes: 24 }, // Season 1 has 24 episodes.
        { season: 2, episodes: 23 }, // Season 2 has 23 episodes.
        { season: 3, episodes: 12 }  // Season 3 has 12 episodes currently.
    ];

    seasonConfig.forEach(config => {
        for (let ep = 1; ep <= config.episodes; ep++) {
            const paddedEpisode = String(ep).padStart(2, '0');
            const valueString = `S${config.season}E${paddedEpisode}`;
            
            const displayText = `Season ${config.season}, Episode ${ep}`;
            
            optionsHTML += `<option value="${valueString}">${displayText}</option>`;

            // Movie insertion between Season 1 and Season 2.
            if (config.season === 1 && ep === 24) {
                optionsHTML += `<option value="M1">Jujutsu Kaisen 0 (Movie)</option>`;
            }
        }
    });

    selectElement.innerHTML = optionsHTML;
    
    // Automatically capture the exact chronological layout of your dropdown safely.
    chronologicalTimeline = Array.from(selectElement.options).map(opt => opt.value);
}

populateEpisodeDropdown();

function parseCSV(text) {
    const lines = text.split("\n");
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const currentLine = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        let firstColumn = currentLine[0] ? currentLine[0].trim().replace(/^"|"$/g, '') : "";
        
        if (
            firstColumn === "" || 
            firstColumn.startsWith("===") || 
            firstColumn.startsWith("---") ||
            firstColumn.toLowerCase().includes("episode")
        ) {
            continue; 
        }
        
        const obj = {};
        headers.forEach((header, index) => {
            let val = currentLine[index] ? currentLine[index].trim().replace(/^"|"$/g, '') : "";
            val = val.replace(/\r$/, '');
            val = val.replace(/""/g, '"');
            obj[header] = val;
        });
        result.push(obj);
    }
    return result;
}

// Reaches out to your local files and boots the site.
async function loadLiveData() {
    try {
        const [masterResponse, logsResponse, changeResponse] = await Promise.all([
            fetch(CHARACTER_MASTER_URL),
            fetch(TIMELINE_LOGS_URL),
            fetch(CHANGELOG_URL),
        ]);

        const masterText = await masterResponse.text();
        const logsText = await logsResponse.text();
        const changeText = await changeResponse.text();

        characterMaster = parseCSV(masterText);
        timelineLogs = parseCSV(logsText);
        changelogs = parseCSV(changeText);

        console.log("Database successfully synchronized!");
        renderCompanionWebsite();
        renderChangelog();

    } catch (error) {
        console.error("Critical Failure linking to database:", error);
        const companionNotice = document.getElementById('companionNotice');
        if (companionNotice) {
            companionNotice.innerHTML = "<strong>Database Connection Error:</strong> Unable to sync with CSVs.";
        }
    }
}

// Connect JS to your index.html structural elements.
const episodeSelect = document.getElementById('episodeSelect');
const companionNotice = document.getElementById('companionNotice');
const characterGrid = document.getElementById('characterGrid');

// =========================================================================
// PORTRAIT CALCULATOR
// =========================================================================
function determinePortraitUrl(character, hasAppeared, characterLogs) {
    const hasAppearanceLog = characterLogs.some(log => log.info_type === 'appearance' || log.info_type === 'appearance_change');

    if (!hasAppearanceLog) {
        return "images/generic_image.png"; 
    }

    const portraitChanges = characterLogs.filter(log => log.info_type === 'appearance_change');
    if (portraitChanges.length > 0) {
        return portraitChanges[portraitChanges.length - 1].text_content;
    }

    return character.reveal_url;
}

// Get only the most recent entry for a specific trait up to currentEpisode.
function getLatestInfo(charId, type, currentEpisode, logs) {
    const currentIndex = chronologicalTimeline.indexOf(currentEpisode);
    
    const history = logs.filter(l => 
        l.character_id === charId && 
        l.info_type === type && 
        chronologicalTimeline.indexOf(l.episode) <= currentIndex
    );
    
    if (history.length === 0) return null;
    
    // Sort mathematically using timeline index position.
    history.sort((a, b) => chronologicalTimeline.indexOf(a.episode) - chronologicalTimeline.indexOf(b.episode));
    return history[history.length - 1]; 
}

// =========================================================================
// MAIN ENGINE FUNCTION: Renders the fighter-select layout
// =========================================================================
function renderCompanionWebsite() {
    if (!episodeSelect) return;
    const savedScrollPosition = window.scrollY;
    const currentEpisode = episodeSelect.value;
    const currentIndex = chronologicalTimeline.indexOf(currentEpisode);
    
    const gridContainer = document.getElementById('characterGrid');
    const loreContainer = document.getElementById('loreListContainer'); 
    
    if (!gridContainer || !loreContainer) return;

    gridContainer.innerHTML = "";
    loreContainer.innerHTML = ""; 
    
    if (currentEpisode === "S1E01") {
        if (companionNotice) {
            companionNotice.style.display = "block";
            companionNotice.innerHTML = `
                <strong>Welcome to the Companion Handbook!</strong><br>
                To keep your experience completely spoiler-free, this app always recaps information 
                <strong>up to the previous episode</strong> of what you select.<br>
                (<em>Ex. Selecting "Episode 15" recaps information from Episodes 1 through 14</em>)<br><br>
                Switch the dropdown to the episode you're <strong>currently watching</strong> to start recapping!
            `;
        }
        loreContainer.innerHTML = '<p style="color: #ffffff; font-size: 1.0rem; text-align: left;"><em>As you progress through the series, key world-building notes will appear here.</em></p>'; 
        return;
    } else {
        if (companionNotice) {
            companionNotice.style.display = "block";
            companionNotice.innerHTML = `Showing information revealed before <strong>${currentEpisode}</strong>.`;
        }
    }

    // Filter using true chronological timeline array indexes.
    const unlockedLogs = timelineLogs.filter(log => chronologicalTimeline.indexOf(log.episode) < currentIndex);
    const activeLogs = timelineLogs.filter(log => chronologicalTimeline.indexOf(log.episode) < currentIndex);

    characterMaster.forEach(character => {
        const characterLogs = activeLogs.filter(log => log.character_id === character.character_id);
        const hasAppeared = characterLogs.some(log => 
            log.info_type === 'appearance' || 
            log.info_type === 'appearance_change' || 
            log.info_type === 'mention'
        );
        
        if (!hasAppeared) return;

        // Gather all logs tracking the status of this character.
        const statusLogs = characterLogs.filter(log => log.info_type === 'archived');
        let currentStatus = "ACTIVE"; // Default state.

        if (statusLogs.length > 0) {
            // Sort them chronologically up to the current episode.
            statusLogs.sort((a, b) => chronologicalTimeline.indexOf(a.episode) - chronologicalTimeline.indexOf(b.episode));
            
            // Read the absolute latest status command.
            currentStatus = statusLogs[statusLogs.length - 1].text_content.toUpperCase().trim();
        }

        // Handles the ARCHIVED state
        if (currentStatus === "ARCHIVED" || currentStatus === "TRUE") {
            return; // Stop rendering this card immediately.
        }

        if (character.affiliation && character.affiliation.toLowerCase() === 'system') {
            return; // Stop rendering here so it only appears in the sidebar.
        }

        // Build dynamic CSS classes based on states.
        let cardModifierClass = "";
        if (currentStatus === "MISSING") cardModifierClass = " status-missing";
        if (currentStatus === "DEAD") cardModifierClass = " status-dead";

        const isMystery = character.is_hidden && String(character.is_hidden).toUpperCase() === "TRUE";
        const hasBeenRevealed = characterLogs.some(l => l.info_type === 'reveal_identity');
        
        // Check for name_override first, fallback to hidden mystery if no override, finally show display_name.
        const nameLogs = characterLogs.filter(log => log.info_type === 'name_override');
        const currentName = nameLogs.length > 0 
            ? nameLogs[nameLogs.length - 1].text_content 
            : character.display_name;

        const nameToDisplay = (isMystery && !hasBeenRevealed && nameLogs.length === 0) ? "???" : currentName;

        const uniqueFacts = resolveLatestState(activeLogs, character.character_id, 'fact', currentEpisode);
        const uniqueBonds = resolveLatestState(activeLogs, character.character_id, 'relation', currentEpisode);

        const portraitUrl = determinePortraitUrl(character, hasAppeared, characterLogs);
        const uniqueId = character.character_id.replace(/\s+/g, '-');
        
        // Check for dynamic affiliation changes in the timeline
        const affiliationLogs = characterLogs.filter(log => log.info_type === 'affiliation_change');
        
        // Affiliation defaults to the master sheet, but overwrites if a timeline_log exists.
        const currentAffiliationStr = affiliationLogs.length > 0 
            ? affiliationLogs[affiliationLogs.length - 1].text_content 
            : character.affiliation;

        const affiliations = currentAffiliationStr 
            ? currentAffiliationStr.split(",").map(a => a.trim()) 
            : [];

        const badgesHTML = affiliations.map(faction => {
            return `<span class="badge affiliation-badge ${faction.toLowerCase().replace(/\s+/g, '-')}">${faction}</span>`;
        }).join('');

        // Check for grade changes in the timeline_logs.
        const gradeLogs = characterLogs.filter(log => log.info_type === 'grade');
        
        // Fetch current grade, defaults to master sheet.
        const currentGradeStr = gradeLogs.length > 0 
            ? gradeLogs[gradeLogs.length - 1].text_content 
            : character.grade;

        let gradeBadgeHTML = "";

        // Format the string and check if it's visible.
        if (currentGradeStr) {
            const cleanGrade = currentGradeStr.trim().toLowerCase();
            
            // Only render if it isn't set to "hidden", "unknown", or left completely blank.
            if (cleanGrade !== "hidden" && cleanGrade !== "unknown" && cleanGrade !== "") {
                const gradeClass = cleanGrade.replace(/\s+/g, '-');
                gradeBadgeHTML = `<span class="badge grade-badge ${gradeClass}">${currentGradeStr.trim()}</span>`;
            }
        }

        // Check if we have anything to render in the drawers.
        const hasContent = uniqueFacts.length > 0 || uniqueBonds.length > 0;

        const isCurrentlyExpanded = expandedDrawers.has(uniqueId);
        const drawerClass = isCurrentlyExpanded ? "expanded" : "collapsed";
        const buttonText = isCurrentlyExpanded ? "Show Less" : "Character Details";

        // BUILD CHARACTER CARD
        const card = document.createElement('div');
        card.className = `character-card${cardModifierClass}`;
        card.innerHTML = `
            <div class="portrait-container">
                <div class="badge-stack-left">
                    ${badgesHTML}
                </div>
                <img src="${portraitUrl}" alt="${nameToDisplay}" class="character-portrait">
                ${gradeBadgeHTML}
            </div>
            
            <div class="name-overlay">
                <h2>${nameToDisplay}</h2>
            </div>
            
            <div class="info-drawer ${drawerClass}" id="drawer-${uniqueId}">
                <div class="drawer-scroll-content">
                    ${uniqueFacts.length > 0 ? `
                        <div class="info-section">
                            <h3>Information</h3>
                            <ul class="info-list">
                                ${uniqueFacts.map(f => {
                                    let badge = '';
                                    if (f.status === 'NEW') badge = '<sup class="status-indicator new-badge">NEW</sup>';
                                    if (f.status === 'UPDATED') badge = '<sup class="status-indicator update-badge">UPDATED</sup>';
                                    
                                    return `<li>${formatText(f.text)} ${badge}</li>`;
                                }).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${uniqueBonds.length > 0 ? `
                        <div class="info-section">
                            <h3>Bonds</h3>
                            <ul class="info-list">
                                ${uniqueBonds.map(b => {
                                    let badge = '';
                                    if (b.status === 'NEW') badge = '<sup class="status-indicator new-badge">NEW</sup>';
                                    if (b.status === 'UPDATED') badge = '<sup class="status-indicator update-badge">UPDATED</sup>';
                                    
                                    return `<li>${formatText(b.text)} ${badge}</li>`;
                                }).join('')}
                            </ul>
                        </div>
                    ` : ''}    

                    ${!hasContent ? `<p class="no-data">Keep watching to find out more!</p>` : ''}
                </div>
            </div>

            <div class="card-details">
                ${hasContent ? `
                    <div class="drawer-controls">
                        <button class="expand-btn" onclick="toggleDrawer('${uniqueId}')">
                            ${buttonText}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        // Push it live.
        gridContainer.appendChild(card);

        // Calculates actual card height and hide "Show More" button if it fits.
        const drawer = card.querySelector(`#drawer-${uniqueId}`);
        const controls = card.querySelector('.drawer-controls');
        
        if (drawer && controls) {
            // If the inner text content is tiny enough to fit natively in the 2-line preview, hide the toggle button
            if (drawer.scrollHeight <= 95) {
                controls.style.display = 'none';
                // Remove the bottom crop mask since the text fits fully without clipping
                drawer.style.maskImage = 'none';
                drawer.style.webkitMaskImage = 'none';
            }
        }
    });

    updateSidebar(currentEpisode);

    requestAnimationFrame(() => {
        window.scrollTo({
            top: savedScrollPosition,
            behavior: 'instant' // Use 'instant' so it doesn't do a hyper-scroll.
        });
    });
}

// Fire calculation loops when the dropdown choice changes values.
if (episodeSelect) {
    episodeSelect.addEventListener('change', renderCompanionWebsite);
}

// Launch the live sync engine immediately when the browser window finishes loading.
window.addEventListener('DOMContentLoaded', loadLiveData);

// Toggle drawer mechanism.
function toggleDrawer(characterId) {
    const drawer = document.getElementById(`drawer-${characterId}`);
    if (!drawer) return;
    
    // Safely dive into the parent container to find the button inside .drawer-controls
    const cardContainer = drawer.closest('.character-card');
    const button = cardContainer ? cardContainer.querySelector('.expand-btn') : null; 
    
    if (drawer.classList.contains("collapsed")) {
        drawer.classList.remove("collapsed");
        drawer.classList.add("expanded");
        if (button) button.innerText = "Show Less";
        
        expandedDrawers.add(characterId); // Drawer is expanded.
    } else {
        drawer.classList.remove("expanded");
        drawer.classList.add("collapsed");
        if (button) button.innerText = "Character Details"; // Kept matching your default string
        
        expandedDrawers.delete(characterId); // Drawer is collapsed.

        // 🎯 FIX: Instantly snap the content box back to the top when closing 
        // This stops the text section from clipping out out-of-bounds on collapse!
        const scrollContent = drawer.querySelector('.drawer-scroll-content');
        if (scrollContent) {
            scrollContent.scrollTop = 0;
        }
    }
}

function resolveLatestState(logs, charId, type, currentEpisode) {
    // Clean protection against missing data arrays.
    const logsByType = logs.filter(l => l.character_id === charId && l.info_type === type);
    if (logsByType.length === 0) return [];
    
    // Sort chronologically using your dropdown's exact layout tracking array.
    logsByType.sort((a, b) => {
        return chronologicalTimeline.indexOf(a.episode) - chronologicalTimeline.indexOf(b.episode);
    });
    
    // Calculate the episode the user just completed watching.
    const currentIndex = chronologicalTimeline.indexOf(currentEpisode);
    const justWatchedEpisode = currentIndex > 0 ? chronologicalTimeline[currentIndex - 1] : null;
    
    const map = new Map();
    const historyCount = new Map();
    
    // Trace item update history.
    logsByType.forEach(log => {
        const key = log.info_id && log.info_id.trim() !== "" ? log.info_id : log.text_content;
        
        if (!historyCount.has(key)) {
            historyCount.set(key, new Set());
        }
        historyCount.get(key).add(log.episode);
        
        // Keeps the absolute latest version of the text.
        map.set(key, log);
    });
    
    // Build output payload sorted strictly by numerical info_id order.
    return Array.from(map.values())
        .sort((a, b) => {
            // If either entry doesn't have an info_id, preserve their chronological order.
            if (!a.info_id || !b.info_id) return 0;

            // Extract just the numbers from the info_id string (e.g., "fact_05" -> 5, "fact_10" -> 10).
            const numA = parseInt(a.info_id.replace(/\D/g, ""), 10) || 0;
            const numB = parseInt(b.info_id.replace(/\D/g, ""), 10) || 0;

            return numA - numB;
        })
        .map(log => {
            const key = log.info_id && log.info_id.trim() !== "" ? log.info_id : log.text_content;
            const distinctEpisodes = historyCount.get(key);
            
            let status = "";
            // If the entry's timestamp matches the episode they JUST finished watching, tag it.
            if (justWatchedEpisode && log.episode === justWatchedEpisode) {
                status = (distinctEpisodes.size === 1) ? "NEW" : "UPDATED";
            }
            
            return {
                text: log.text_content,
                status: status
            };
        });
}

function updateSidebar(currentEpisode) {
    const sidebarContainer = document.querySelector('#loreListContainer'); 
    if (!sidebarContainer) return;
    sidebarContainer.innerHTML = '';

    const currentIndex = chronologicalTimeline.indexOf(currentEpisode);
    // Identify the exact episode the user just completed watching.
    const justWatchedEpisode = currentIndex > 0 ? chronologicalTimeline[currentIndex - 1] : null;

    // Filter logs up to the current episode index chronologically.
    const activeSidebarLogs = timelineLogs.filter(log => chronologicalTimeline.indexOf(log.episode) < currentIndex);

    const glossaryItems = characterMaster
    .filter(item => item.affiliation && item.affiliation.toLowerCase() === 'system')
    .map(item => item.character_id);

    glossaryItems.forEach(itemId => {
        const itemLogs = activeSidebarLogs.filter(log => log.character_id === itemId);

        const itemHasAppeared = itemLogs.some(log => log.info_type === 'appearance' || log.info_type === 'mention');
        if (!itemHasAppeared) return; 

        const nameLog = itemLogs.find(log => log.info_type === 'reveal_identity');
        const displayName = nameLog ? nameLog.text_content : "???";

        // Gather all facts and mentions for this glossary item.
        const factLogs = itemLogs.filter(log => 
            log.info_type === 'fact' || log.info_type === 'mention'
        );

        // Sort timeline logs chronologically so history calculates accurately.
        factLogs.sort((a, b) => chronologicalTimeline.indexOf(a.episode) - chronologicalTimeline.indexOf(b.episode));

        const uniqueFactsMap = new Map();
        const historyCount = new Map();

        // Map out histories and fallback safely to text_content if info_id is blank.
        factLogs.forEach(log => {
            const key = log.info_id && log.info_id.trim() !== "" ? log.info_id : log.text_content;
            
            if (!historyCount.has(key)) {
                historyCount.set(key, new Set());
            }
            historyCount.get(key).add(log.episode);
            
            uniqueFactsMap.set(key, log);
        });

        // Build out final objects paired with their dynamic badge status.
        const finalFacts = Array.from(uniqueFactsMap.values()).map(log => {
            const key = log.info_id && log.info_id.trim() !== "" ? log.info_id : log.text_content;
            const distinctEpisodes = historyCount.get(key);
            
            let status = "";
            if (justWatchedEpisode && log.episode === justWatchedEpisode) {
                status = (distinctEpisodes.size === 1) ? "NEW" : "UPDATED";
            }
            
            return {
                text: log.text_content,
                status: status
            };
        });

        // Render UI using clean lists that support badge injection.
        let factsHTML = '';
        if (finalFacts.length > 0) {
            factsHTML = `<ul class="glossary-list">`;
            finalFacts.forEach(f => {
                let badge = '';
                if (f.status === 'NEW') badge = ' <sup class="status-indicator new-badge">NEW</sup>';
                if (f.status === 'UPDATED') badge = ' <sup class="status-indicator update-badge">UPDATED</sup>';
                
                factsHTML += `<li>${formatText(f.text)}${badge}</li>`;
            });
            factsHTML += `</ul>`;
        } else {
            factsHTML = `<p>Awaiting spoiler-free info curation.</p>`;
        }

        const glossaryCard = document.createElement('div');
        glossaryCard.className = 'glossary-card'; 
        glossaryCard.innerHTML = `
            <h3>${displayName}</h3>
            ${factsHTML}
        `;
        
        sidebarContainer.appendChild(glossaryCard);
    });
}

const prevBtn = document.getElementById('prevEp');
const nextBtn = document.getElementById('nextEp');

if (prevBtn && episodeSelect) {
    prevBtn.addEventListener('click', () => {
        if (episodeSelect.selectedIndex > 0) {
            episodeSelect.selectedIndex--;
            episodeSelect.dispatchEvent(new Event('change'));
        }
    });
}

if (nextBtn && episodeSelect) {
    nextBtn.addEventListener('click', () => {
        if (episodeSelect.selectedIndex < episodeSelect.options.length - 1) {
            episodeSelect.selectedIndex++;
            episodeSelect.dispatchEvent(new Event('change'));
        }
    });
}

// Text formatting for spreadsheets
function formatText(text) {
    if (!text) return "";
    let formattedText = text;

    // Convert newline characters (Alt+Enter) into HTML line breaks.
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    // Converts **text** to bold.
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Converts *text* to italic.
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // (Optional) Converts __text__ to underline.
    formattedText = formattedText.replace(/\_\_(.*?)\_\_/g, '<u>$1</u>');

    return formattedText;
}

function renderChangelog() {
    const logContainer = document.querySelector('#changelogs ul'); 
    if (!logContainer) return; 
    
    logContainer.innerHTML = ""; 
    
    const sortedLogs = [...changelogs].reverse(); 
    
    sortedLogs.forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${entry.date}:</strong> ${entry.update_note}`;
        logContainer.appendChild(li);
    });
}