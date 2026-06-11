// =========================================================================
// LIVE GOOGLE SHEETS CONNECTION CONFIGURATION
// =========================================================================

// =========================================================================
// EPISODE SELECTOR GENERATOR: Automatically populates 3 seasons of content
// =========================================================================
function populateEpisodeDropdown() {
    const selectElement = document.getElementById("episodeSelect");
    let optionsHTML = "";

    // Configuration for your series structure
    const seasonConfig = [
        { season: 1, episodes: 24 }, // Season 1 has 24 episodes
        { season: 2, episodes: 23 }, // Season 2 has 23 episodes
        { season: 3, episodes: 12 }  // Season 3 has 12 episodes currently
    ];

    seasonConfig.forEach(config => {
        for (let ep = 1; ep <= config.episodes; ep++) {
            // Format the value string to match your spreadsheet logs perfectly (e.g., S1E01, S1E15)
            const paddedEpisode = String(ep).padStart(2, '0');
            const valueString = `S${config.season}E${paddedEpisode}`;
            
            // Format the user-friendly display text for the dropdown
            const displayText = `Season ${config.season}, Episode ${ep}`;
            
            // Append the HTML line string
            optionsHTML += `<option value="${valueString}">${displayText}</option>`;

            // Insert the Movie between Season 1 and Season 2 loops:
            if (config.season === 1 && ep === 24) {
                optionsHTML += `<option value="M1">Jujutsu Kaisen 0 (Movie)</option>`;
            }
        }
    });

    // Inject the fully built list of 72 options directly into the HTML element
    selectElement.innerHTML = optionsHTML;
}

// 🚀 RUN THIS FUNCTION immediately when your app scripts load!
populateEpisodeDropdown();

// 🔴 PASTE YOUR ACTUAL GOOGLE CSV LINKS INSIDE THESE QUOTES:
const CHARACTER_MASTER_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQuhaIjHDWNjF9A4ZxL_GXljLbQF40XMc8EtSo5AV9I7-l57bzd9zdxWnuvqPdRMmyj57LTPqCKmvwW/pub?gid=2003623475&single=true&output=csv";
const TIMELINE_LOGS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQuhaIjHDWNjF9A4ZxL_GXljLbQF40XMc8EtSo5AV9I7-l57bzd9zdxWnuvqPdRMmyj57LTPqCKmvwW/pub?gid=0&single=true&output=csv";

// Global data containers that will hold our sheet data once downloaded
let characterMaster = [];
let timelineLogs = [];

// Helper function that translates raw spreadsheet text (CSV) into clean JavaScript objects
function parseCSV(text) {
    const lines = text.split("\n");
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // 🛡️ THE BULLETPROOF SPLITTER: Splits by commas ONLY if they have an even number of quotes ahead of them!
        // This preserves full sentences, spaces, and text strings flawlessly.
        const currentLine = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        const obj = {};
        headers.forEach((header, index) => {
            let val = currentLine[index] ? currentLine[index].trim().replace(/^"|"$/g, '') : "";
            val = val.replace(/\r$/, '');
            obj[header] = val;
        });
        result.push(obj);
    }
    return result;
}

// THE DOWNLOAD ENGINE: Reaches out to Google, grabs the data, and boots the site
async function loadLiveGoogleData() {
    try {
        // 1. Download both spreadsheet feeds simultaneously
        const [masterResponse, logsResponse] = await Promise.all([
            fetch(CHARACTER_MASTER_URL),
            fetch(TIMELINE_LOGS_URL)
        ]);

        // 2. Convert the responses into raw text strings
        const masterText = await masterResponse.text();
        const logsText = await logsResponse.text();

        // 3. Parse the CSV rows into our global data containers
        characterMaster = parseCSV(masterText);
        timelineLogs = parseCSV(logsText);

        console.log("Database successfully synchronized with Google Sheets!");
        
        // 4. Run the rendering engine for the first time now that the data is safely here
        renderCompanionWebsite();

    } catch (error) {
        console.error("Critical Failure linking to Google Sheets database:", error);
        companionNotice.innerHTML = "⚠️ <strong>Database Connection Error:</strong> Unable to sync with Google Sheets. Check your file links or console logs.";
    }
}

// Connect JS to your index.html structural elements
const episodeSelect = document.getElementById('episodeSelect');
const companionNotice = document.getElementById('companionNotice');
const characterGrid = document.getElementById('characterGrid');

// =========================================================================
// REWORKED PORTRAIT CALCULATOR: Pure, lean file path selector
// =========================================================================
function determinePortraitUrl(character, hasAppeared, characterLogs) {
    const portraitChanges = characterLogs.filter(log => log.info_type === 'appearance_change');
    
    if (!hasAppeared) {
        return character.reveal_url;
    }

    if (portraitChanges.length > 0) {
        // If an appearance change happened, simply pull the new pre-cropped file path!
        return portraitChanges[portraitChanges.length - 1].text_content;
    }

    return character.reveal_url;
}

// =========================================================================
// MAIN ENGINE FUNCTION: Renders the fighter-select layout
// =========================================================================
function renderCompanionWebsite() {
    const currentEpisode = episodeSelect.value;
    characterGrid.innerHTML = "";
    
    if (currentEpisode === "S1E01") {
            companionNotice.style.display = "block";
            companionNotice.innerHTML = `
                <strong>Welcome to the Handbook!</strong><br>
                To keep your experience completely spoiler-free, this app always recaps information 
                <strong>up to the previous episode</strong> of what you select 
                (<em>For example: selecting Episode 15 recaps information from Episodes 1 through 14</em>).<br><br>
                Switch the dropdown to <strong>Episode 2</strong> to start recapping!
            `;
            return;
    } else {
        companionNotice.style.display = "block";
        companionNotice.innerHTML = `Showing information revealed before <strong>${currentEpisode}</strong>.`;
    }

    const unlockedLogs = timelineLogs.filter(log => log.episode < currentEpisode);

    characterMaster.forEach(character => {
        // 1. First, check if they have appeared
        const characterLogs = unlockedLogs.filter(log => log.character_id === character.character_id);
        const hasAppeared = characterLogs.some(log => log.info_type === 'appearance');

        // 2. 🌟 If they haven't appeared, skip them immediately!
        if (!hasAppeared) return;

        // 3. 🟢 NOW 'character' is perfectly safe to use for everything else below:
        const portraitUrl = determinePortraitUrl(character, hasAppeared, characterLogs);
        const facts = characterLogs.filter(log => log.info_type === 'fact');
        const bonds = characterLogs.filter(log => log.info_type === 'relation');
        const nameToDisplay = character.display_name;

        // 4. Clean up and split the multi-affiliations
        const affiliations = character.affiliation 
            ? character.affiliation.split(",").map(a => a.trim()) 
            : [];

        // 5. Generate the HTML strings for the badges
        const badgesHTML = affiliations.map(faction => {
            return `<span class="badge affiliation-badge ${faction.toLowerCase().replace(/\s+/g, '-')}">${faction}</span>`;
        }).join('');

        // 6. Construct the visual HTML Card
        const card = document.createElement('div');
        card.className = 'character-card';
        
        let cardHTML = `
            <div class="portrait-container">
                <div class="badge-stack-left">
                    ${badgesHTML}
                </div>

                <img src="${portraitUrl}" alt="${nameToDisplay}" class="character-portrait">
                
                <div class="name-overlay">
                    <h2>${nameToDisplay}</h2>
                </div>
            </div>
        `;

        // 7. Append the Intel and Bonds bullet points
        cardHTML += `
            <div class="card-details">
                ${bonds.length > 0 ? `<div class="info-section"><h3>Bonds</h3><ul class="info-list">${bonds.map(b => `<li>${b.text_content}</li>`).join('')}</ul></div>` : ''}
                ${facts.length > 0 ? `<div class="info-section"><h3>Intel</h3><ul class="info-list">${facts.map(f => `<li>${f.text_content}</li>`).join('')}</ul></div>` : ''}
            </div>
        `;

        // 8. Push it live to the grid
        card.innerHTML = cardHTML;
        characterGrid.appendChild(card);
});
}

// Fire calculation loops when the dropdown choice changes values
episodeSelect.addEventListener('change', renderCompanionWebsite);

// Launch the live sync engine immediately when the browser window finishes loading
window.addEventListener('DOMContentLoaded', loadLiveGoogleData);