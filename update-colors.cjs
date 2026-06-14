const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.vue')) results.push(file);
        }
    });
    return results;
}

const files = walk('d:/310-Project/310-Store/app/pages');

let updatedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let lines = content.split('\n');
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
        // Target div headers with bg-muted/40
        if (lines[i].includes('bg-muted/40') && lines[i].includes('<div') && (lines[i].includes('border-b') || lines[i].includes('px-4'))) {
            // Skip TableRow
            if (lines[i].includes('<TableRow')) continue;

            let context = lines.slice(i, i + 6).join(' ');

            let bgClass = '';
            let textClass = '';
            let iconClass = '';

            if (context.match(/t\('[^']*(details|info|basic)[^']*'\)/i)) {
                bgClass = 'bg-[#134E4A] border-[#134E4A]';
                textClass = 'text-white';
                iconClass = 'text-white/70';
            } else if (context.match(/t\('[^']*(items|products|photos|disposition)[^']*'\)/i)) {
                bgClass = 'bg-[#0D9488] border-[#0D9488]';
                textClass = 'text-white';
                iconClass = 'text-white/70';
            } else if (context.match(/t\('[^']*(terms)[^']*'\)/i)) {
                bgClass = 'bg-[#22C55E] border-[#22C55E]';
                textClass = 'text-white';
                iconClass = 'text-white/70';
            } else if (context.match(/t\('[^']*(notes)[^']*'\)/i)) {
                bgClass = 'bg-[#BBF7D0] border-[#BBF7D0]';
                textClass = 'text-green-950';
                iconClass = 'text-green-900/70';
            }

            if (bgClass) {
                // Replace background
                lines[i] = lines[i].replace('bg-muted/40', `${bgClass} ${textClass}`);

                // Replace icon color on the same line (targets capitalized Vue components)
                lines[i] = lines[i].replace(/<([A-Z][A-Za-z]+)[^>]*text-muted-foreground[^>]*>/g, (match) => {
                    return match.replace('text-muted-foreground', iconClass);
                });

                // Replace icon color on subsequent lines if multi-line
                for (let j = i; j < Math.min(i + 4, lines.length); j++) {
                    if (lines[j].match(/<([A-Z][A-Za-z]+)[^>]*text-muted-foreground[^>]*>/)) {
                        lines[j] = lines[j].replace('text-muted-foreground', iconClass);
                    }
                }

                changed = true;
            }
        }
    }

    if (changed) {
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        updatedCount++;
    }
});

console.log(`Updated ${updatedCount} files.`);