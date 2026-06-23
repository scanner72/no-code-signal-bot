const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '../frontend/src/blocks/registry.ts');
const MANUAL_PATH = path.join(__dirname, '../MANUAL.md');
const JSON_OUTPUT_PATH = path.join(__dirname, '../frontend/src/assets/docs.json');

function extractNodes() {
    const content = fs.readFileSync(REGISTRY_PATH, 'utf8');
    
    // Регулярное выражение для извлечения блоков из реестра
    // Ищем строки вида: indicator_rsi: { ... }
    const registryMatch = content.match(/export const registry: Record<string, BlockConfig> = \{([\s\S]+?)\};/);
    if (!registryMatch) {
        console.error('Could not find registry object in registry.ts');
        return [];
    }

    const registryBody = registryMatch[1];
    const nodeRegex = /(\w+):\s*\{([\s\S]+?)\},/g;
    let match;
    const nodes = [];

    while ((match = nodeRegex.exec(registryBody)) !== null) {
        const id = match[1];
        const body = match[2];
        
        const nameMatch = body.match(/name:\s*['"](.+?)['"]/);
        const categoryMatch = body.match(/category:\s*['"](.+?)['"]/);
        const defaultDataMatch = body.match(/defaultData:\s*(\{[\s\S]*?\})/);

        if (nameMatch && categoryMatch) {
            let params = '—';
            if (defaultDataMatch) {
                try {
                    // Пытаемся распарсить параметры (упрощенно)
                    const dataStr = defaultDataMatch[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"');
                    const data = JSON.parse(dataStr);
                    if (data.params) {
                        params = Object.entries(data.params)
                            .map(([k, v]) => `\`${k}\` (${v})`)
                            .join(', ');
                    } else if (Object.keys(data).length > 0) {
                        params = Object.entries(data)
                            .filter(([k]) => k !== 'name' && k !== 'type')
                            .map(([k, v]) => `\`${k}\` (${typeof v === 'object' ? '...' : v})`)
                            .join(', ');
                    }
                } catch (e) {
                    // Если не распарсилось, ищем вхождения параметров через regex
                    const pMatch = defaultDataMatch[1].match(/params:\s*\{([\s\S]+?)\}/);
                    if (pMatch) {
                        params = pMatch[1].trim().replace(/\s+/g, ' ');
                    }
                }
            }

            nodes.push({
                id,
                name: nameMatch[1],
                category: categoryMatch[1],
                params: params || '—'
            });
        }
    }
    return nodes;
}

function generateMarkdown(nodes) {
    const categories = [...new Set(nodes.map(n => n.category))];
    let md = '';

    categories.forEach(cat => {
        md += `\n### ${cat}\n\n`;
        md += `| Название | Описание / Параметры по умолчанию |\n`;
        md += `| :--- | :--- |\n`;
        
        const catNodes = nodes.filter(n => n.category === cat);
        catNodes.forEach(node => {
            md += `| **${node.name}** | Параметры: ${node.params} |\n`;
        });
    });

    return md;
}

function updateManual(newNodeDocs) {
    let content = fs.readFileSync(MANUAL_PATH, 'utf8');
    
    const startMarker = '## 5. Типы нод — полный справочник';
    const endMarker = '---'; // Предполагаем, что раздел заканчивается разделителем
    
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) {
        console.error('Marker not found in MANUAL.md');
        return;
    }

    const contentAfterStart = content.substring(startIndex + startMarker.length);
    const endIndex = contentAfterStart.indexOf(endMarker);
    
    if (endIndex === -1) {
        console.error('End marker not found');
        return;
    }

    const before = content.substring(0, startIndex + startMarker.length);
    const after = contentAfterStart.substring(endIndex);
    
    const updatedContent = `${before}\n\nНиже приведен автоматически сгенерированный список всех доступных блоков из реестра системы.\n${newNodeDocs}\n\n${after}`;
    
    fs.writeFileSync(MANUAL_PATH, updatedContent);
    console.log('MANUAL.md updated successfully!');
    
    // Генерируем JSON для фронтенда
    generateDocsJson(updatedContent);
}

function generateDocsJson(content) {
    const rawSections = {};
    const parts = content.split(/\n##\s+/);
    
    parts.forEach(part => {
        const lines = part.split('\n');
        const header = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        
        if (header) {
            rawSections[header] = body;
        }
    });

    // Маппинг вкладок на разделы мануала
    const tabMapping = {
        'dashboard': '3. Главный экран (Dashboard)',
        'builder': '4. Интерфейс конструктора',
        'strategies': '12. Библиотека шаблонов',
        'signals': '5. Типы нод — полный справочник',
        'backtest': '7. Бэктест',
        'fleet': '9. Управление флотом ботов (Fleet)',
        'ml': '10. AI-обучение: ML Intelligence Trainer',
        'cross': '11. Кросс-биржевая аналитика',
        'settings': '14. Настройки и Риск-менеджмент',
        'docs': '1. Концепция системы'
    };

    const sections = [];
    Object.entries(tabMapping).forEach(([tabId, sectionHeader]) => {
        // Ищем ключ, который содержит sectionHeader
        const fullHeader = Object.keys(rawSections).find(h => h.includes(sectionHeader));
        if (fullHeader) {
            const body = rawSections[fullHeader];
            
            // Парсим подразделы (###)
            const subparts = body.split(/\n###\s+/);
            const mainContent = subparts[0].trim();
            const subsections = subparts.slice(1).map(sp => {
                const slines = sp.split('\n');
                return {
                    title: slines[0].trim(),
                    content: slines.slice(1).join('\n').trim()
                };
            });

            sections.push({
                id: tabId,
                title: fullHeader.replace(/^\d+\.\s+/, ''),
                content: mainContent,
                subsections: subsections
            });
        }
    });

    const output = {
        sections,
        nodes: extractNodes()
    };

    const assetsDir = path.dirname(JSON_OUTPUT_PATH);
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    fs.writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log('docs.json generated for frontend!');
}

const nodes = extractNodes();
if (nodes.length > 0) {
    const md = generateMarkdown(nodes);
    updateManual(md);
} else {
    console.log('No nodes found to document.');
}
