const METRICS = [
    { key: "ts", short: "2K", label: "Time Spy", detail: "2K 光栅", weight: 0.34 },
    { key: "tse", short: "4K", label: "Time Spy Extreme", detail: "4K 光栅", weight: 0.26 },
    { key: "pr", short: "光追", label: "Port Royal", detail: "光追", weight: 0.24 },
    { key: "sn", short: "重载", label: "Steel Nomad", detail: "4K 重负载", weight: 0.16 },
];

const BASE_DATA = Array.isArray(window.GPU_DATA) ? window.GPU_DATA : [];
const LATEST_DATA = Array.isArray(window.GPU_LATEST_DATA) ? window.GPU_LATEST_DATA : [];
const RAW_DATA = mergeGpuSources(BASE_DATA, LATEST_DATA);
const MAX_BY_METRIC = METRICS.reduce((acc, metric) => {
    acc[metric.key] = RAW_DATA.reduce((max, gpu) => Math.max(max, Number(gpu[metric.key]) || 0), 0);
    return acc;
}, {});

const DB = RAW_DATA
    .map((gpu) => enrichGpu(gpu))
    .sort((a, b) => a.rank - b.rank);

const state = {
    feature: "compare",
    segment: "Desktop",
    activeInput: "gpuAInput",
};

let els = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
    cacheElements();
    bindEvents();
    renderHeroStats();
    updateFeatureUI();
    updateSegmentUI();
    updateDatalist();
}

function cacheElements() {
    els = {
        heroStats: document.getElementById("heroStats"),
        featureSwitch: document.getElementById("featureSwitch"),
        segmentSwitch: document.getElementById("segmentSwitch"),
        gpuAInput: document.getElementById("gpuAInput"),
        gpuBInput: document.getElementById("gpuBInput"),
        lookupInput: document.getElementById("lookupInput"),
        compareBtn: document.getElementById("compareBtn"),
        lookupBtn: document.getElementById("lookupBtn"),
        gpuOptions: document.getElementById("gpuOptions"),
        compareControls: document.getElementById("compareControls"),
        lookupControls: document.getElementById("lookupControls"),
        compareResult: document.getElementById("compareResult"),
        lookupResult: document.getElementById("lookupResult"),
        diamondChart: document.getElementById("diamondChart"),
        compareMeta: document.getElementById("compareMeta"),
        verdictPanel: document.getElementById("verdictPanel"),
        compareMetrics: document.getElementById("compareMetrics"),
        lookupSummary: document.getElementById("lookupSummary"),
        lookupNear: document.getElementById("lookupNear"),
        lookupLadder: document.getElementById("lookupLadder"),
    };
}

function bindEvents() {
    els.compareBtn.addEventListener("click", executeComparison);
    els.lookupBtn.addEventListener("click", executeLookup);

    [els.gpuAInput, els.gpuBInput, els.lookupInput].forEach((input) => {
        input.addEventListener("focus", () => {
            state.activeInput = input.id;
        });
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                input.id === "lookupInput" ? executeLookup() : executeComparison();
            }
        });
    });

    els.featureSwitch.addEventListener("click", (event) => {
        const button = event.target.closest("[data-feature]");
        if (!button) return;
        state.feature = button.dataset.feature;
        updateFeatureUI();
    });

    els.segmentSwitch.addEventListener("click", (event) => {
        const button = event.target.closest("[data-segment]");
        if (!button) return;
        state.segment = button.dataset.segment;
        updateSegmentUI();
        updateDatalist();
    });
}

function enrichGpu(gpu) {
    const entry = { ...gpu };
    entry.aliases = buildAliases(entry);
    entry.overall = computeOverall(entry);
    entry.tier = classifyTier(entry.ts);
    entry.availableMetricCount = METRICS.filter((metric) => isNumber(entry[metric.key])).length;
    return entry;
}

function buildAliases(gpu) {
    const normalizedName = normalize(gpu.name);
    const normalizedRaw = normalize(gpu.rawName || gpu.name);
    const modelOnly = normalize(gpu.modelCode || "");
    const noBrand = normalizedName.replace(/^(RTX|GTX|RX|ARC|GT)/, "");
    const aliases = new Set([normalizedName, normalizedRaw, modelOnly, noBrand]);

    if (normalizedName.includes("SUPER")) aliases.add(normalizedName.replace("SUPER", "S"));
    if (normalizedName.includes("TISUPER")) aliases.add(normalizedName.replace("TISUPER", "TIS"));
    if (normalizedName.endsWith("M")) aliases.add(normalizedName.replace(/M$/, ""));
    if (normalizedName.includes("MOBILE")) {
        aliases.add(normalizedName.replace("MOBILE", ""));
        aliases.add(normalizedName.replace("MOBILE", "M"));
    }
    if (normalizedName.includes("MAXQ")) {
        aliases.add(normalizedName.replace("MAXQ", ""));
        aliases.add(normalizedName.replace("MAXQ", "MQ"));
    }
    if (normalizedName.includes("REFRESH")) aliases.add(normalizedName.replace("REFRESH", ""));
    if (normalizedName.includes("ADAGENERATION")) aliases.add(normalizedName.replace("ADAGENERATION", ""));
    if (normalizedName.endsWith("D")) aliases.add(normalizedName.replace(/D$/, ""));

    return Array.from(aliases).filter(Boolean);
}

function computeOverall(gpu) {
    let weightedTotal = 0;
    let weightSum = 0;

    METRICS.forEach((metric) => {
        const value = Number(gpu[metric.key]);
        if (!Number.isFinite(value)) return;
        const maxValue = MAX_BY_METRIC[metric.key] || 1;
        weightedTotal += (value / maxValue) * metric.weight;
        weightSum += metric.weight;
    });

    return weightSum ? (weightedTotal / weightSum) * 100 : 0;
}

function classifyTier(ts) {
    if (!isNumber(ts)) return "数据不完整";
    if (ts >= 30000) return "旗舰";
    if (ts >= 22000) return "高端";
    if (ts >= 16000) return "中高端";
    if (ts >= 11000) return "主流";
    if (ts >= 7000) return "入门";
    return "老卡 / 基础";
}

function normalize(input) {
    return String(input || "")
        .toUpperCase()
        .replace(/GEFORCE|RADEON|GRAPHICS/g, "")
        .replace(/TI\s*SUPER/g, "TISUPER")
        .replace(/SUPER/g, "SUPER")
        .replace(/EXTREME/g, "EX")
        .replace(/[^A-Z0-9]/g, "");
}

function isNumber(value) {
    return Number.isFinite(Number(value));
}

function getSegmentPool(segment = state.segment) {
    if (segment === "All") return DB;
    return DB.filter((gpu) => gpu.segment === segment);
}

function updateSegmentUI() {
    els.segmentSwitch.querySelectorAll("[data-segment]").forEach((button) => {
        button.classList.toggle("active", button.dataset.segment === state.segment);
    });
}

function updateFeatureUI() {
    els.featureSwitch.querySelectorAll("[data-feature]").forEach((button) => {
        button.classList.toggle("active", button.dataset.feature === state.feature);
    });
    els.compareControls.classList.toggle("hidden", state.feature !== "compare");
    els.lookupControls.classList.toggle("hidden", state.feature !== "lookup");
    els.compareResult.classList.toggle("hidden", state.feature !== "compare" || !els.compareResult.dataset.ready);
    els.lookupResult.classList.toggle("hidden", state.feature !== "lookup" || !els.lookupResult.dataset.ready);
}

function renderHeroStats() {
    const vendorCounts = ["NVIDIA", "AMD", "Intel"]
        .map((vendor) => {
            const count = DB.filter((gpu) => gpu.vendor === vendor).length;
            return `${vendor} ${count}`;
        })
        .join(" / ");
    const segmentCounts = ["Desktop", "Laptop", "Integrated"]
        .map((segment) => {
            const label = segment === "Desktop" ? "桌面" : segment === "Laptop" ? "笔记本" : "集显";
            return `${label} ${DB.filter((gpu) => gpu.segment === segment).length}`;
        })
        .join(" / ");

    const cards = [
        { value: DB.length, label: "显卡数量", note: "覆盖桌面、笔记本、集成。" },
        { value: METRICS.length, label: "维度", note: "维度图按 2K / 4K / 光追 / 重载绘制。" },
        { value: segmentCounts, label: "分段", note: "可单独搜，也可一起搜。" },
        { value: "双模式", label: "使用方式", note: `品牌分布：${vendorCounts}` },
    ];

    els.heroStats.innerHTML = cards
        .map(
            (item) => `
                <div class="stat-tile">
                    <strong>${escapeHtml(String(item.value))}</strong>
                    <span>${escapeHtml(item.label)}<br>${escapeHtml(item.note)}</span>
                </div>
            `
        )
        .join("");
}

function updateDatalist() {
    const options = getSegmentPool()
        .map(
            (gpu) =>
                `<option value="${escapeAttr(gpu.name)}" label="${escapeAttr(`${gpu.vendor} · ${gpu.segment} · #${gpu.rank}`)}"></option>`
        )
        .join("");

    els.gpuOptions.innerHTML = options;
}

function fillInput(value, targetId) {
    const target = document.getElementById(targetId || state.activeInput) || els.gpuAInput;
    target.value = value;
    target.focus();
    state.activeInput = target.id;
}

function executeComparison() {
    const queryA = els.gpuAInput.value.trim();
    const queryB = els.gpuBInput.value.trim();

    const gpuA = findGpu(queryA);
    if (!gpuA) {
        renderLookupFailure("gpuAInput", queryA, "基准卡 A 没找到");
        return;
    }

    let gpuB = null;
    if (queryB) {
        gpuB = findGpu(queryB);
        if (!gpuB) {
            renderLookupFailure("gpuBInput", queryB, "对比卡 B 没找到");
            return;
        }
    }

    renderComparison(gpuA, gpuB);
}

function executeLookup() {
    const query = els.lookupInput.value.trim();
    const gpu = findGpu(query);
    if (!gpu) {
        renderLookupFailure("lookupInput", query, "查阅显卡没找到");
        return;
    }
    renderLookup(gpu);
}

function renderLookupFailure(targetId, query, title) {
    const suggestions = searchCandidates(query, 6);
    const normalized = normalize(query);
    const mobileHint =
        state.segment === "Desktop" && normalized.endsWith("M")
            ? "你当前选的是桌面卡，但输入看起来像笔记本 M 版。先切到“笔记本卡(M)”再搜，会更准确。"
            : "";
    const integratedHint =
        state.segment !== "Integrated" && /^(7|8)\d{2}M$/.test(normalized)
            ? "如果你要找的是核显，比如 780M、890M，请切到“集成”或“一起搜”。"
            : "";
    const names = suggestions.slice(0, 5).map((gpu) => gpu.name).join(" / ");
    window.alert(
        `${title}\n\n你输入的是：${query || "空值"}\n${mobileHint}${integratedHint}${names ? `\n可试试：${names}` : ""}`
    );
    const target = document.getElementById(targetId);
    if (target) target.focus();
}

function findGpu(query) {
    return searchCandidates(query, 1)[0] || null;
}

function searchCandidates(query, limit) {
    const normalized = normalize(query);
    if (!normalized) return [];

    const preferredPool = getPreferredSearchPool(normalized);
    const primary = rankCandidates(preferredPool, normalized);
    if (primary.length >= limit) return primary.slice(0, limit);

    if (preferredPool === DB || (state.segment === "Desktop" && normalized.endsWith("M"))) return primary.slice(0, limit);

    const fallback = rankCandidates(DB, normalized).filter(
        (candidate) => !primary.some((item) => item.name === candidate.name)
    );
    return [...primary, ...fallback].slice(0, limit);
}

function getPreferredSearchPool(normalized) {
    if (state.segment === "All") return DB;
    if (state.segment === "Integrated") return getSegmentPool();
    if (normalized.endsWith("M")) {
        return state.segment === "Laptop" ? DB.filter((gpu) => gpu.segment === "Laptop") : [];
    }
    return getSegmentPool();
}

function rankCandidates(pool, normalized) {
    return pool
        .map((gpu) => ({ gpu, score: getSearchScore(gpu, normalized) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.gpu.rank - b.gpu.rank)
        .map((item) => item.gpu);
}

function getSearchScore(gpu, normalized) {
    const compactNormalized = normalized.replace(/^(RTX|GTX|RX|ARC|GT)/, "");
    const variantPenalty = getVariantPenalty(gpu, compactNormalized || normalized);
    if (normalized === normalize(gpu.name) || normalized === normalize(gpu.rawName || gpu.name)) return 1600;
    if (compactNormalized && gpu.aliases.includes(compactNormalized)) return 1500 - variantPenalty;
    if (gpu.modelCode === normalized) return 1460 - variantPenalty;

    let bestScore = 0;
    gpu.aliases.forEach((alias) => {
        if (alias.startsWith(normalized)) {
            bestScore = Math.max(bestScore, 1200 - (alias.length - normalized.length) * 4 - variantPenalty);
        }
        const index = alias.indexOf(normalized);
        if (index >= 0) {
            bestScore = Math.max(bestScore, 1000 - index * 12 - (alias.length - normalized.length) * 2 - variantPenalty);
        }
    });

    if (!bestScore && /^\d{4}$/.test(normalized) && /^\d{4}$/.test(gpu.modelCode)) {
        const distance = Math.abs(Number(gpu.modelCode) - Number(normalized));
        bestScore = Math.max(bestScore, 400 - distance);
    }

    return bestScore;
}

function getVariantPenalty(gpu, normalizedQuery) {
    const normalizedName = normalize(gpu.name);
    const stripped = normalizedName
        .replace(/^(RTX|GTX|RX|ARC|GT)/, "")
        .replace(gpu.modelCode || "", "");

    if (!stripped) return 0;
    if (normalizedQuery.endsWith("M")) return 0;
    if (stripped === "M") return 90;
    if (stripped === "D") return 20;
    if (stripped === "SUPER" || stripped === "S") return 40;
    if (stripped === "TI") return 55;
    if (stripped === "TISUPER" || stripped === "TIS") return 75;
    return 35;
}

function renderComparison(gpuA, gpuB) {
    state.feature = "compare";
    renderDiamondChart(gpuA, gpuB);
    els.compareMeta.innerHTML = renderCompareMeta(gpuA, gpuB);
    els.verdictPanel.innerHTML = renderVerdict(gpuA, gpuB);
    els.compareMetrics.innerHTML = renderCompareMetrics(gpuA, gpuB);
    els.compareResult.dataset.ready = "true";
    updateFeatureUI();
}

function renderLookup(gpu) {
    state.feature = "lookup";
    els.lookupSummary.innerHTML = renderLookupSummary(gpu);
    els.lookupNear.innerHTML = renderNearestPanel(gpu, "接近替代");
    els.lookupLadder.innerHTML = renderLadderPanel(gpu, "上下相邻");
    els.lookupResult.dataset.ready = "true";
    updateFeatureUI();
}

function renderCompareMeta(gpuA, gpuB) {
    const cards = [gpuA, gpuB].filter(Boolean).map((gpu, index) => `
        <div class="compare-mini">
            <div class="micro-label">显卡 ${index === 0 ? "A" : "B"}</div>
            <strong>${escapeHtml(gpu.name)}</strong>
            <span>${escapeHtml(formatSegment(gpu.segment))} · 第 ${gpu.rank} 位</span>
            <span>档位：${escapeHtml(gpu.tier)}</span>
        </div>
    `).join("");
    return cards;
}

function renderLookupSummary(gpu) {
    return `
        <div class="sub-panel">
            <div>
                <div class="micro-label">当前查阅</div>
                <h4>${escapeHtml(gpu.name)}</h4>
                <div class="section-note">${escapeHtml(gpu.vendor)} · ${escapeHtml(formatSegment(gpu.segment))} · 第 ${gpu.rank} 位 · ${escapeHtml(gpu.tier)}</div>
            </div>
            <div class="list-stack">
                <div class="match-item">
                    <div class="match-top">
                        <div>
                            <div class="match-name">主榜分数</div>
                            <div class="match-meta">Time Spy / 2K 光栅</div>
                        </div>
                        <div class="diff-badge positive">${gpu.ts ?? "N/A"}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDiamondChart(gpuA, gpuB) {
    const size = 320;
    const center = size / 2;
    const radius = 112;
    const chartScale = buildChartScale([gpuA, gpuB].filter(Boolean));

    const axes = [
        { x: center, y: center - radius, label: "2K" },
        { x: center + radius, y: center, label: "光追" },
        { x: center, y: center + radius, label: "4K" },
        { x: center - radius, y: center, label: "重载" },
    ];

    const polygonA = buildDiamondPolygon(gpuA, center, radius, chartScale);
    const polygonB = gpuB ? buildDiamondPolygon(gpuB, center, radius, chartScale) : "";

    const grid = [0.5, 1].map((ratio) => {
        const r = radius * ratio;
        const points = [
            `${center},${center - r}`,
            `${center + r},${center}`,
            `${center},${center + r}`,
            `${center - r},${center}`,
        ].join(" ");
        return `<polygon points="${points}" fill="none" stroke="rgba(23,23,23,0.1)" stroke-width="0.8" />`;
    });

    const axisLines = axes
        .map(
            (axis) =>
                `<line x1="${center}" y1="${center}" x2="${axis.x}" y2="${axis.y}" stroke="rgba(23,23,23,0.1)" stroke-width="0.8" />`
        )
        .join("");

    const labels = axes
        .map((axis) => {
            const dx = axis.x === center ? 0 : axis.x > center ? 18 : -18;
            const dy = axis.y === center ? 0 : axis.y > center ? 22 : -16;
            return `<text x="${axis.x + dx}" y="${axis.y + dy}" font-size="12" font-weight="700" text-anchor="middle">${axis.label}</text>`;
        })
        .join("");

    els.diamondChart.innerHTML = `
        <svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" aria-label="GPU geometric comparison chart">
            ${grid.join("")}
            ${axisLines}
            <polygon points="${polygonA}" fill="rgba(17,17,17,0.14)" stroke="var(--a)" stroke-width="2" />
            ${
                gpuB
                    ? `<polygon points="${polygonB}" fill="rgba(223,91,57,0.14)" stroke="var(--b)" stroke-width="2" stroke-dasharray="4 4" />`
                    : ""
            }
            ${labels}
        </svg>
        <div class="chart-legend">
            <span class="legend-item" style="color: var(--a);"><span class="legend-line"></span>${escapeHtml(gpuA.name)}</span>
            ${
                gpuB
                    ? `<span class="legend-item" style="color: var(--b);"><span class="legend-line"></span>${escapeHtml(gpuB.name)}</span>`
                    : ""
            }
        </div>
    `;
}

function buildChartScale(gpus) {
    return METRICS.reduce((acc, metric) => {
        const globalMax = MAX_BY_METRIC[metric.key] || 1;
        const localMax = gpus.reduce((max, gpu) => Math.max(max, Number(gpu?.[metric.key]) || 0), 0);
        const minScale = globalMax * 0.18;
        const paddedLocal = localMax * 1.12;
        acc[metric.key] = Math.min(globalMax, Math.max(minScale, paddedLocal, 1));
        return acc;
    }, {});
}

function buildDiamondPolygon(gpu, center, radius, chartScale) {
    const axisOrder = ["ts", "pr", "tse", "sn"];
    const points = axisOrder.map((key, index) => {
        const value = isNumber(gpu[key]) ? Number(gpu[key]) : 0;
        const ratio = Math.min(1, value / (chartScale[key] || 1));
        if (index === 0) return `${center},${center - radius * ratio}`;
        if (index === 1) return `${center + radius * ratio},${center}`;
        if (index === 2) return `${center},${center + radius * ratio}`;
        return `${center - radius * ratio},${center}`;
    });
    return points.join(" ");
}

function renderVerdict(gpuA, gpuB) {
    if (!gpuB) {
        return `
            <div class="section-kicker">对比结果</div>
            <h3>再输入一张 B，维度图就会直接显示两张卡的差异。</h3>
            <p>下方会补充四项原始分数，方便直接看清每一项差距。</p>
        `;
    }

    const tsA = isNumber(gpuA.ts) ? Number(gpuA.ts) : null;
    const tsB = isNumber(gpuB.ts) ? Number(gpuB.ts) : null;
    if (!isNumber(tsA) || !isNumber(tsB) || tsA === 0 || tsB === 0) {
        return `
            <div class="section-kicker">双卡结论</div>
            <h3>这两张卡缺少可直接比较的 2K 光栅分数。</h3>
            <p>双卡结论现在只按 2K 光栅判断，避免缺项时出现误导性的夸张百分比。</p>
            <div class="footer-note">下方只显示双方都有值的分项。</div>
        `;
    }

    const delta = computeForwardDelta(tsA, tsB);
    const leader = delta >= 0 ? gpuA : gpuB;
    const follower = delta >= 0 ? gpuB : gpuA;
    const gap = Math.abs(delta);
    const relation = `${leader.name} 比 ${follower.name} 在 2K 光栅上约高 ${gap.toFixed(1)}%`;
    const tierText = gap < 5 ? "基本同级" : gap < 12 ? "已有体感差距" : "已经拉开一档";

    return `
        <div class="section-kicker">双卡结论</div>
        <h3>${escapeHtml(relation)}，${tierText}。</h3>
        <p>这里的结论只看 2K 光栅 / Time Spy，更稳，也更适合缺项较多的显卡。</p>
        <div class="footer-note">下方只显示双方都有值的分项。</div>
    `;
}

function renderCompareMetrics(gpuA, gpuB) {
    const rows = METRICS
        .map((metric) => renderCompareMetricRow(metric, gpuA, gpuB))
        .filter(Boolean)
        .join("");
    return `
        <div class="sub-panel">
            <div>
                <div class="micro-label">四项对比</div>
                <h4>原始分数和差距</h4>
            </div>
            <div class="list-stack">
                ${rows || `<div class="empty-list">当前没有双方都完整的数据项可比较。</div>`}
            </div>
        </div>
    `;
}

function renderCompareMetricRow(metric, gpuA, gpuB) {
    const valueA = isNumber(gpuA?.[metric.key]) ? Number(gpuA[metric.key]) : null;
    const valueB = isNumber(gpuB?.[metric.key]) ? Number(gpuB[metric.key]) : null;
    const english = metric.label;

    if (!gpuB) {
        if (!isNumber(valueA)) return "";
        return `
            <div class="compare-metric-row">
                <div class="compare-metric-head">
                    <div>
                        <div class="match-name">${escapeHtml(metric.detail)}</div>
                        <div class="match-meta">${escapeHtml(english)}</div>
                    </div>
                    <div class="diff-badge positive">${valueA ?? "N/A"}</div>
                </div>
            </div>
        `;
    }

    if (!isNumber(valueA) || !isNumber(valueB) || valueA === 0 || valueB === 0) return "";

    const delta = computeMetricDelta(valueA, valueB);
    const sentence = buildMetricSentence(metric, gpuA, gpuB, valueA, valueB, delta);

    return `
        <div class="compare-metric-row">
            <div class="compare-metric-head">
                <div>
                    <div class="match-name">${escapeHtml(metric.detail)}</div>
                    <div class="match-meta">${escapeHtml(english)}</div>
                </div>
                <div class="diff-badge ${delta !== null && delta >= 0 ? "positive" : "negative"}">
                    ${delta === null ? "N/A" : `${delta >= 0 ? "A" : "B"} ${Math.abs(delta).toFixed(1)}%`}
                </div>
            </div>
            <div class="section-note">${escapeHtml(sentence)}</div>
            <div class="compare-metric-values">
                <span>A · ${escapeHtml(gpuA.name)} ${valueA ?? "N/A"}</span>
                <span>B · ${escapeHtml(gpuB.name)} ${valueB ?? "N/A"}</span>
            </div>
        </div>
    `;
}

function buildMetricSentence(metric, gpuA, gpuB, valueA, valueB, delta) {
    if (Math.abs(delta) < 3) {
        return `${gpuA.name} 和 ${gpuB.name} 在 ${metric.detail} 上基本接近。`;
    }
    return delta >= 0
        ? `${gpuA.name} 比 ${gpuB.name} 在 ${metric.detail} 上约高 ${Math.abs(delta).toFixed(1)}%。`
        : `${gpuB.name} 比 ${gpuA.name} 在 ${metric.detail} 上约高 ${(((valueB - valueA) / valueA) * 100).toFixed(1)}%。`;
}

function computeForwardDelta(valueA, valueB) {
    if (!isNumber(valueA) || !isNumber(valueB) || Number(valueA) === 0 || Number(valueB) === 0) return 0;
    if (Number(valueA) >= Number(valueB)) return ((Number(valueA) - Number(valueB)) / Number(valueB)) * 100;
    return -(((Number(valueB) - Number(valueA)) / Number(valueA)) * 100);
}

function computeOverallDelta(gpuA, gpuB) {
    const sharedMetrics = METRICS.filter((metric) => isNumber(gpuA[metric.key]) && isNumber(gpuB[metric.key]));
    if (!sharedMetrics.length) return 0;

    let scoreA = 0;
    let scoreB = 0;
    let weightSum = 0;

    sharedMetrics.forEach((metric) => {
        const maxValue = MAX_BY_METRIC[metric.key] || 1;
        scoreA += (gpuA[metric.key] / maxValue) * metric.weight;
        scoreB += (gpuB[metric.key] / maxValue) * metric.weight;
        weightSum += metric.weight;
    });

    if (!weightSum || !scoreB) return 0;
    return ((scoreA / weightSum - scoreB / weightSum) / (scoreB / weightSum)) * 100;
}

function getStrongestGap(gpuA, gpuB) {
    const ranked = METRICS.map((metric) => ({
        metric,
        delta: computeMetricDelta(gpuA[metric.key], gpuB[metric.key]),
    }))
        .filter((item) => item.delta !== null)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    if (!ranked.length) {
        return "这两张卡缺少可直接对比的共同分项，建议改看接近替代卡和主榜位置。";
    }

    const strongest = ranked[0];
    const leader = strongest.delta >= 0 ? gpuA.name : gpuB.name;
    return `${strongest.metric.detail} 上差距最明显：${leader} 领先约 ${Math.abs(strongest.delta).toFixed(1)}%。`;
}

function computeMetricDelta(valueA, valueB) {
    if (!isNumber(valueA) || !isNumber(valueB) || Number(valueB) === 0) return null;
    return ((Number(valueA) - Number(valueB)) / Number(valueB)) * 100;
}

function renderNearestPanel(targetGpu, title) {
    const matches = findNearestCards(targetGpu, 6);
    return `
        <div class="sub-panel">
            <div>
                <div class="micro-label">综合接近度</div>
                <h4>${escapeHtml(title)}</h4>
                <div class="section-note">现在只按 2K 光栅 / Time Spy 接近度排序。</div>
            </div>
            <div class="list-stack">
                ${
                    matches.length
                        ? matches.map((match) => renderMatchItem(targetGpu, match)).join("")
                        : `<div class="empty-list">没有找到可用的接近替代卡。</div>`
                }
            </div>
        </div>
    `;
}

function findNearestCards(targetGpu, limit) {
    const pool = DB.filter((gpu) => gpu.name !== targetGpu.name && gpu.segment === targetGpu.segment)
        .map((gpu) => ({
            gpu,
            distance: computeSimilarityDistance(targetGpu, gpu),
            overallDelta: computeTsGap(gpu, targetGpu),
        }))
        .filter((item) => Number.isFinite(item.distance))
        .sort((a, b) => a.distance - b.distance || Math.abs(a.overallDelta) - Math.abs(b.overallDelta));

    if (!pool.length) return [];

    const vendorPriority =
        targetGpu.vendor === "NVIDIA"
            ? ["AMD", "NVIDIA", "Intel"]
            : targetGpu.vendor === "AMD"
                ? ["NVIDIA", "AMD", "Intel"]
                : ["NVIDIA", "AMD", "Intel"];

    const selected = [];
    vendorPriority.forEach((vendor) => {
        const candidate = pool.find(
            (item) => item.gpu.vendor === vendor && !selected.some((selectedItem) => selectedItem.gpu.name === item.gpu.name)
        );
        if (candidate) selected.push(candidate);
    });

    pool.forEach((item) => {
        if (selected.length >= limit) return;
        if (!selected.some((selectedItem) => selectedItem.gpu.name === item.gpu.name)) {
            selected.push(item);
        }
    });

    return selected.slice(0, limit);
}

function computeSimilarityDistance(base, candidate) {
    const baseValue = base.ts;
    const candidateValue = candidate.ts;
    if (!isNumber(baseValue) || !isNumber(candidateValue) || Number(baseValue) === 0) return Infinity;
    return Math.abs(((Number(candidateValue) - Number(baseValue)) / Number(baseValue)) * 100);
}

function computeTsGap(candidate, base) {
    if (!isNumber(candidate?.ts) || !isNumber(base?.ts) || Number(base.ts) === 0) return 0;
    return ((Number(candidate.ts) - Number(base.ts)) / Number(base.ts)) * 100;
}

function renderMatchItem(base, item) {
    const gpu = item.gpu;
    const diff = item.overallDelta;
    const chips = METRICS.map((metric) => {
        const metricDelta = computeMetricDelta(gpu[metric.key], base[metric.key]);
        if (metricDelta === null) {
            return `<span class="mini-chip">${escapeHtml(metric.short)} N/A</span>`;
        }
        return `<span class="mini-chip">${escapeHtml(metric.short)} ${formatSigned(metricDelta)}%</span>`;
    }).join("");

    return `
        <div class="match-item">
            <div class="match-top">
                <div>
                    <div class="match-name">${escapeHtml(gpu.name)}</div>
                    <div class="match-meta">${escapeHtml(gpu.vendor)} · ${escapeHtml(formatSegment(gpu.segment))} · 第 ${gpu.rank} 位</div>
                </div>
                <div class="diff-badge ${diff >= 0 ? "positive" : "negative"}">${formatSigned(diff)}%</div>
            </div>
            <div class="match-meta">相对 ${escapeHtml(base.name)} 的综合差距。数值越接近 0，越像真正的对位替代。</div>
            <div class="match-metrics">${chips}</div>
        </div>
    `;
}

function renderLadderPanel(targetGpu, title) {
    const ladderSlice = getLadderSlice(targetGpu, 3);
    return `
        <div class="sub-panel">
            <div>
                <div class="micro-label">主榜位置</div>
                <h4>${escapeHtml(title)}</h4>
                <div class="section-note">直接看这张卡的上下一档是谁。</div>
            </div>
            <div class="list-stack">
                ${ladderSlice.map((gpu) => renderLadderItem(gpu, targetGpu)).join("")}
            </div>
        </div>
    `;
}

function getLadderSlice(targetGpu, radius) {
    const segmentPool = DB.filter((gpu) => gpu.segment === targetGpu.segment);
    const index = segmentPool.findIndex((gpu) => gpu.name === targetGpu.name);
    const start = Math.max(0, index - radius);
    const end = Math.min(segmentPool.length, index + radius + 1);
    return segmentPool.slice(start, end);
}

function renderLadderItem(gpu, targetGpu) {
    const maxTs = DB[0]?.ts || 1;
    const width = isNumber(gpu.ts) ? (gpu.ts / maxTs) * 100 : 0;
    const isCurrent = gpu.name === targetGpu.name;
    return `
        <div class="ladder-item ${isCurrent ? "current" : ""}">
            <div class="ladder-top">
                <div>
                    <div class="ladder-name">${escapeHtml(gpu.name)}</div>
                    <div class="ladder-meta">${escapeHtml(gpu.vendor)} · ${escapeHtml(formatSegment(gpu.segment))} · 第 ${gpu.rank} 位</div>
                </div>
                <div class="diff-badge ${isCurrent ? "positive" : "negative"}">${gpu.ts ?? "N/A"}</div>
            </div>
            <div class="ladder-bar"><span style="width:${width}%"></span></div>
        </div>
    `;
}

function formatSigned(value) {
    if (!Number.isFinite(value)) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function mergeGpuSources(base, updates) {
    const merged = new Map();

    base.forEach((gpu) => {
        merged.set(getGpuKey(gpu), { ...gpu });
    });

    updates.forEach((gpu) => {
        const key = getGpuKey(gpu);
        const existing = merged.get(key) || {};
        merged.set(key, {
            ...existing,
            ...gpu,
            rawName: gpu.rawName || existing.rawName || gpu.name,
        });
    });

    return Array.from(merged.values())
        .sort((a, b) => {
            const aTs = Number(a.ts);
            const bTs = Number(b.ts);
            if (Number.isFinite(bTs) && Number.isFinite(aTs)) return bTs - aTs;
            if (Number.isFinite(bTs)) return 1;
            if (Number.isFinite(aTs)) return -1;
            return String(a.name).localeCompare(String(b.name), "zh-CN");
        })
        .map((gpu, index) => ({ ...gpu, rank: index + 1 }));
}

function getGpuKey(gpu) {
    return normalize(gpu.rawName || gpu.name || "");
}

function formatSegment(segment) {
    if (segment === "Laptop") return "笔记本";
    if (segment === "Integrated") return "集显";
    return "桌面";
}

window.__GPU_COMPARE_DEBUG__ = {
    state,
    db: DB,
    findGpu,
    searchCandidates,
    computeOverallDelta,
    computeMetricDelta,
};
