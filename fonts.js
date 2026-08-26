const FONT_CATALOG = [
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "Oswald",
    "Source Sans Pro",
    "Slabo 27px",
    "Raleway",
    "PT Sans",
    "Merriweather",
    "Nunito",
    "Playfair Display",
    "Rubik",
    "Lora",
    "Work Sans",
    "Fira Sans",
    "Quicksand",
    "Inter",
    "Outfit",
    "Cabin",
    "Inconsolata",
    "Josefin Sans",
    "DM Sans",
    "Anton"
];

const loadedFonts = new Set();

function loadGoogleFont(fontName) {
    if (loadedFonts.has(fontName)) return;
    
    const formattedName = fontName.replace(/ /g, '+');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    loadedFonts.add(fontName);
}

function initFontPickers() {
    const pickers = document.querySelectorAll('.font-picker');
    
    pickers.forEach(picker => {
        FONT_CATALOG.forEach(font => {
            const option = document.createElement('option');
            option.value = font;
            option.textContent = font;
            picker.appendChild(option);
        });
        
        // Initial load for default fonts
        loadGoogleFont(picker.value);
        
        // Load dynamically on change
        picker.addEventListener('change', (e) => {
            loadGoogleFont(e.target.value);
            // We'll dispatch a custom event to tell app.js to re-render
            window.dispatchEvent(new Event('settingsChanged'));
        });
    });
}

// Call on load
document.addEventListener('DOMContentLoaded', initFontPickers);
