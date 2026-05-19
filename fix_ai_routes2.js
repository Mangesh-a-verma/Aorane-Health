const fs = require('fs');

let file = fs.readFileSync('artifacts/api-server/src/routes/modules/ai.ts', 'utf8');

// The file has these blocks
/*
    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];

      }
    } catch (e) {}
*/
file = file.replace(/    const payload: import\("\.\.\/\.\.\/lib\/ai"\)\.AIMessage\[\] = \[\{ role: "user", content: prompt \}\];\s*\}\s*\} catch \(e\) \{\}/g, '    const payload: import("../../lib/ai").AIMessage[] = [{ role: "user", content: prompt }];');


/*
    const payload: import("../../lib/ai").AIMessage[] = [{
      role: "user",
      content: prompt,
      media: {
        mimeType,
        data: imageBase64
      }
    }];

      }
    } catch (e) {}
*/
file = file.replace(/    const payload: import\("\.\.\/\.\.\/lib\/ai"\)\.AIMessage\[\] = \[\{\s*role: "user",\s*content: prompt,\s*media: \{\s*mimeType,\s*data: imageBase64\s*\}\s*\}\];\s*\}\s*\} catch \(e\) \{\}/g, '    const payload: import("../../lib/ai").AIMessage[] = [{\n      role: "user",\n      content: prompt,\n      media: {\n        mimeType,\n        data: imageBase64\n      }\n    }];');

fs.writeFileSync('artifacts/api-server/src/routes/modules/ai.ts', file);
