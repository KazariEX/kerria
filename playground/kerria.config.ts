import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { createKerria, useLoad, useSource } from "../src";

const kerria = createKerria("Kerria", () => {
    const meta = useLoad("meta", {
        out: "./dist/meta.json",
        update(newVal, oldVal) {
            newVal.chapters = oldVal?.chapters ?? {};
            return newVal;
        },
        output(val) {
            const chapters = Object.entries(val.chapters)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([, data]) => data);
            return {
                ...val,
                chapters,
            };
        },
    });

    useSource(0, {
        base: "./posts",
        dist: "./dist/posts",
        ext: ".md",
        async parse(path, info) {
            const file = await readFile(path);
            const text = file.toString();
            const { data, content } = matter(text);

            await info.output(path, content);
            return {
                data,
            };
        },
        cache(cache) {
            const { data } = cache;
            const { title } = data;

            meta.value.chapters[title] = {
                title,
                ...data,
            };
        },
        unlink(cache) {
            const { data } = cache;
            const { title } = data;

            delete meta.value.chapters[title];
        },
    });
});

kerria.build();
kerria.watch();
