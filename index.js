// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

var utils = require('./utils');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on(['check_suite.requested', 'check_run.rerequested'], check)

  async function check (context) {
    const startTime = new Date()

    // construct the PR object
    // run each check
      // report each check that fails
      // if no check failed report all checks passed

    // extract info
    const {
      check_run: checkRun,
      check_suite,
      repository
    }
    = context.payload;
    let checkSuite = check_suite || checkRun.check_suite;
    const {
      head_branch: headBranch,
      head_sha: headSha
    }
    = checkSuite;
    // console.log(checkSuite.pull_requests)

    // get the .prlint file
    const prlintResponse = await checkPrlintFile(context, {
      checkRun,
      headBranch,
      headSha,
      repository,
      startTime
    });
    if (prlintResponse.error) {
      return;
    }

    // check the commit
    if (prlintResponse.data.checks.commit) {
      const { commit: commitChecks } = prlintResponse.data.checks;
      let commitChecksNames = Object.keys(commitChecks);
      if (checkRun) {
        let commitCheckNameToReRun = commitChecksNames.find(name => name === checkRun.name);
        if (commitCheckNameToReRun) {
          commitChecksNames = [commitCheckNameToReRun];
        } else {
          commitChecksNames = [];
        }
      }
      if (commitChecksNames.length > 0) {
        var getCommitResponse = await context.github.repos.getCommit({
          owner: repository.owner.login,
          repo: repository.name,
          sha: headSha
        });
        const commit = { ...getCommitResponse.data };
        checkCommit(context, {
          checkRun,
          commit,
          commitChecks,
          commitChecksNames,
          headBranch,
          headSha,
          startTime
        });
      }
    }
  }

  async function checkCommit(context, {checkRun, commit, commitChecks, commitChecksNames, headBranch, headSha, startTime}) {
    let allChecksPassed = true;
    for (let i = 0; i < commitChecksNames.length; i++) {
      const name = commitChecksNames[i];
      let script = commitChecks[name];
      // if script is an array, join them
      if (Array.isArray(script)) {
        script = script.join("\n");
      } else if (typeof script === 'string') {
        script = `return (${script})`;
      }
      const scope = {
        commit
      };
      const response = await utils.runScript(script, scope);
      allChecksPassed = allChecksPassed && response.data;
      if (!response.data || (checkRun && checkRun.name === name)) {
        postCheckResult(context, {
          name,
          conclusion: !response.data ? 'failure' : 'success',
          headBranch,
          headSha,
          startTime,
          status: 'completed',
          summary:
            response.error
            ? response.error.message
            : `The check '${name}' ${response.data === true ? 'passed' : 'failed'}.`,
          // text: "There's supposed to be a .prlint file in the root directory",
          title: name
        });
      }
    }
    if (allChecksPassed) {
      postCheckResult(context, {
        name: 'All commit checks passed',
        conclusion: 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: 'All commit checks passed.',
        // text: "",
        title: 'All commit checks passed'
      });
    }
  }
  async function checkPrlintFile(context, {checkRun, headBranch, headSha, repository, startTime}) {
    const response = await utils.getPrlintFile(repository.owner.login, repository.name, headBranch);
    const name = 'Check for .prlint file';
    if (!response.data || (checkRun && checkRun.name === name)) {
      postCheckResult(context, {
        name,
        conclusion: response.error ? 'failure' : 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: response.error ? response.error.message : `The check '${name}' passed.`,
        // text: "There's supposed to be a .prlint file in the root directory",
        title: name
      });
    }
    return response;
  }

  async function postCheckResult (context, {
    conclusion,
    headBranch,
    headSha,
    name,
    startTime,
    status,
    summary,
    text,
    title
  }) {
    // Probot API note: context.repo() => {username: 'hiimbex', repo: 'testing-things'}
    context.github.checks.create(context.repo({
      name,
      head_branch: headBranch,
      head_sha: headSha,
      status,
      started_at: startTime,
      conclusion,
      completed_at: new Date(),
      output: {
        title,
        summary,
        text
      }
    }))
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}
