var request = require('request-promise-native');

module.exports = {
  async getPrlintFile(owner, repo, branch) {
    try {
      let data = await request({
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.prlint`,
        method: 'GET'
      });
       return { data: JSON.parse(data) };
    } catch (error) {
      return { error };
    }
  }
}
