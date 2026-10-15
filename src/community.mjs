export const pairAccount = {
  name: "Shanghai Institute for Physical Artificial Intelligence and Robotics",
  id: "gh_6279469803d5",
  certification: "Other organization",
  certifiedEntity: "Shanghai Institute for Physical Artificial Intelligence and Robotics",
  source: "Account details supplied by the DexArena project owner"
};
export const communityBody = `
<section class="page-hero"><div><span>Community & updates</span><h1>Community</h1><p>Follow PAIR on WeChat for institute updates.</p></div></section>
<section class="section community-content" id="wechat">
  <div class="community-section-heading"><span>WeChat official account</span><h2>${pairAccount.name} <span>PAIR</span></h2><p>Follow the institute for research updates, conference news and Physical AI coverage. Search WeChat using the exact account ID below.</p></div>
  <dl class="community-account-details">
    <div><dt>Institute</dt><dd>${pairAccount.name} (PAIR)</dd></div>
    <div><dt>Account ID</dt><dd><code id="pair-wechat-id">${pairAccount.id}</code><button class="text-copy-button" type="button" data-copy-text="${pairAccount.id}" data-copy-target="pair-wechat-id">Copy ID</button><span class="copy-status" role="status" aria-live="polite"></span></dd></div>
    <div><dt>Certification</dt><dd>${pairAccount.certification}</dd></div>
    <div><dt>Certified entity</dt><dd>${pairAccount.certifiedEntity}</dd></div>
  </dl>
  <ol class="wechat-follow-steps"><li><span>01</span><p>Copy the account ID: <b>${pairAccount.id}</b>.</p></li><li><span>02</span><p>Open WeChat Search and search for the exact ID under Official Accounts.</p></li><li><span>03</span><p>Confirm the account ID and institute certification before following.</p></li></ol>
  <p class="community-note">Account details were supplied by the project owner. Institution and certification names are rendered in English here; WeChat may show their original-language names. A verified follow QR image has not been supplied.</p>
  <div class="community-resource-links"><a href="/report/#coverage">Read PAIR coverage →</a><a href="/paper/">Read the DexArena paper →</a><a href="/docs/resources/">Code, data & release status →</a></div>
</section>
`;
