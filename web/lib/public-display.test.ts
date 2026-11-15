import assert from "node:assert/strict";
import test from "node:test";
import { isObviouslyTestCampaign, isObviouslyTestFeedback } from "./public-display.ts";

test("hides a feedback row that is just the word Test", () => {
  assert.equal(isObviouslyTestFeedback({ name: "Test", message: "Test" }), true);
  assert.equal(isObviouslyTestFeedback({ name: null, message: "testing" }), true);
  assert.equal(isObviouslyTestFeedback({ name: "Amina", message: "The airtime arrived the same day." }), false);
  assert.equal(isObviouslyTestFeedback({ name: "Test", message: "The setup call was useful." }), false);
});

test("hides the game-demo campaign and keeps real businesses", () => {
  assert.equal(
    isObviouslyTestCampaign({
      title: "How quick are you, share your fastest time to finish a level",
      orgName: "Memorabilia",
      slug: "how-quick-are-you-share-your-fastest-time-to-fin",
      blurb: "Send a screenshot of your quickest time to complete the project",
    }),
    true
  );
  assert.equal(
    isObviouslyTestCampaign({
      title: "MuyuBakes",
      orgName: "MuyuBakes",
      slug: "muyubakes",
      blurb: "Bring your friends with this campaign link, get extra cookies.",
    }),
    false
  );
  assert.equal(
    isObviouslyTestCampaign({
      title: "Founding 20",
      orgName: "FitTribe",
      slug: "founding-members",
      blurb: "First 20 people to bring a friend get founding-member status.",
    }),
    false
  );
  assert.equal(isObviouslyTestCampaign({ title: "Test", orgName: "Westlands Cafe", slug: "test" }), true);
});
