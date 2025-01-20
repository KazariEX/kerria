import { link } from "node:fs/promises";
import { basename, resolve as nodeResolve } from "node:path";

const resolve = (...paths: string[]) => nodeResolve(import.meta.dirname, ...paths);

const destinations = [
    ["../README.md", "../packages/core"]
];

for (const [src, dest] of destinations) {
    await link(resolve(src), resolve(dest, basename(src)));
}