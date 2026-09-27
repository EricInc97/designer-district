/**
 * Seedance 2.5, text to video, through the official Higgsfield SDK.
 *
 *   npm run seedance
 *
 * which is `node --env-file=.env.local --import tsx index.ts`. The env file is
 * read by Node itself rather than by a dotenv package, and `tsx` is here
 * because this package is CommonJS, so plain `node index.ts` would choke on
 * the ESM import below.
 *
 * That same CommonJS-ness is why the work sits in `main()` rather than at the
 * top level: tsx compiles this to CJS and CJS has no top-level await. The
 * alternatives were renaming the file to .mts or turning the whole Next app
 * into an ESM package, and neither is worth it to save one function wrapper.
 *
 * The credential is read from the environment and never printed. The v2 client
 * is server-side only by design — it carries an account credential, so nothing
 * here may be imported into anything that reaches a browser.
 *
 * Schema verified against the model's own API reference:
 *   open.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference
 *     prompt         string,  required
 *     duration       integer, 4 to 30, default 5
 *     resolution     480p | 720p, default 720p
 *     aspect_ratio   16:9 | 4:3 | 1:1 | 3:4 | 9:16 | 21:9, default 16:9
 *     output_format  mp4 | mov, default mp4
 *     generate_audio boolean, default true
 *
 * This makes a real, billable generation every time it is run.
 */

import { config, higgsfield } from "@higgsfield/client/v2";

const MODEL = "bytedance/seedance-2.5/text-to-video";

async function main(): Promise<void> {
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials) {
    // Named, not printed: the value never leaves the environment.
    console.error(
      "HF_CREDENTIALS is not set. Put it in .env.local as key-id:key-secret.",
    );
    process.exit(1);
  }

  config({ credentials });

  console.log(`Submitting to ${MODEL} — this is a billable generation.`);

  let result;
  try {
    result = await higgsfield.subscribe(MODEL, {
      input: {
        prompt: "A cinematic scene at sunset",
        duration: 5,
        resolution: "720p",
        aspect_ratio: "16:9",
        output_format: "mp4",
        generate_audio: true,
      },
      // The SDK polls through to a terminal state for us.
      withPolling: true,
    });
  } catch (err) {
    console.error(
      "Generation request failed:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  console.log(`request_id: ${result.request_id}`);
  console.log(`status:     ${result.status}`);

  /* A terminal state that is not `completed` is not a success and must not be
   * reported as one. The SDK's own union is queued | in_progress | completed |
   * failed | nsfw — it does not include `canceled`, which the REST lifecycle
   * documentation does list as terminal, so that case is matched as a string
   * rather than by type and cannot fall through unnoticed. */
  if (result.status !== "completed") {
    const why =
      result.status === "nsfw"
        ? "rejected by content moderation"
        : String(result.status) === "canceled"
          ? "the request was canceled"
          : result.status === "failed"
            ? "generation failed"
            : `generation ended while still ${result.status}`;
    console.error(`No video produced: ${why}.`);
    process.exit(1);
  }

  const url = result.video?.url;
  if (!url) {
    console.error(
      "Reported completed but returned no video URL. Full response:",
      JSON.stringify(result, null, 2),
    );
    process.exit(1);
  }

  console.log("\nVideo URL:");
  console.log(url);
  console.log(
    "\nNote: generated media URLs expire seven days after completion. " +
      "Copy anything worth keeping into your own storage.",
  );
}

main().catch((err: unknown) => {
  console.error(
    "Unexpected failure:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
