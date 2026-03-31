const fs = require("fs");
const vm = require("vm");

const context = {
    window: {},
    console,
    document: {
        addEventListener() {},
        getElementById() {
            return null;
        },
    },
};

context.window = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync("./gpu-data.js", "utf8"), context, { filename: "gpu-data.js" });
vm.runInContext(fs.readFileSync("./gpu-latest.js", "utf8"), context, { filename: "gpu-latest.js" });
vm.runInContext(fs.readFileSync("./gpu-app.js", "utf8"), context, { filename: "gpu-app.js" });

const api = context.__GPU_COMPARE_DEBUG__;

const tests = [
    {
        name: "desktop exact",
        segment: "Desktop",
        input: "RTX 5060",
        expect: "RTX 5060",
    },
    {
        name: "desktop fuzzy lowercase",
        segment: "Desktop",
        input: "rtx5060",
        expect: "RTX 5060",
    },
    {
        name: "desktop fuzzy no spaces amd",
        segment: "Desktop",
        input: "rx9060xt8gb",
        expect: "RX 9060 XT 8GB",
    },
    {
        name: "desktop numeric only",
        segment: "Desktop",
        input: "4070",
        expect: "RTX 4070",
    },
    {
        name: "laptop exact m suffix",
        segment: "Laptop",
        input: "4060 m",
        expect: "RTX 4060 M",
    },
    {
        name: "laptop fuzzy no spaces",
        segment: "Laptop",
        input: "rtx5070tim",
        expect: "RTX 5070 Ti M",
    },
    {
        name: "laptop missing 3050 mobile",
        segment: "Laptop",
        input: "3050m",
        expect: "RTX 3050 Mobile",
    },
    {
        name: "integrated 780m",
        segment: "Integrated",
        input: "780m",
        expect: "Radeon 780M",
    },
    {
        name: "integrated exact 890m",
        segment: "Integrated",
        input: "890m",
        expect: "Radeon 890M",
    },
    {
        name: "desktop should not resolve laptop when desktop selected",
        segment: "Desktop",
        input: "4060m",
        expect: null,
    },
];

for (const test of tests) {
    api.state.segment = test.segment;
    const actual = api.findGpu(test.input)?.name || null;
    console.log(JSON.stringify({ ...test, actual, pass: actual === test.expect }));
}

api.state.segment = "Desktop";
const a = api.findGpu("RTX 5060");
const b = api.findGpu("rx9060xt8gb");
console.log(
    JSON.stringify({
        name: "comparison sample",
        a: a?.name,
        b: b?.name,
        overallDelta: Number(api.computeOverallDelta(a, b).toFixed(2)),
        tsDelta: Number(api.computeMetricDelta(a.ts, b.ts).toFixed(2)),
        rtDelta: Number(api.computeMetricDelta(a.pr, b.pr).toFixed(2)),
    })
);
