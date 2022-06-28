import { testAccessControl } from "./accesscontrol";
import { testCampaign } from "./campaigns";

describe("Donations", function () {
  testAccessControl();
  testCampaign();
});
