// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

var utils = require('./utils');

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on(['check_suite.requested', 'check_run.rerequested'], handleCheckEvents)

  async function handleCheckEvents(context) {
    const startTime = new Date()

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
      head_sha: headSha,
      pull_requests: pullRequests
    }
    = checkSuite;

    // get the .ghint file
    const ghintResponse = await checkGhintFile(context, {
      checkRun,
      headBranch,
      headSha,
      repository,
      startTime
    });
    if (!ghintResponse.data || !ghintResponse.data.checks) {
      return;
    }
    const ghintFile = ghintResponse.data;
    const options = ghintFile.options || {};

    // get the pull
    let pullResponse = {};
    pullResponse = await checkPull(context, {
      checkRun,
      headBranch,
      headSha,
      options,
      pull: pullRequests[0],
      repository,
      startTime
    });
    if (!pullResponse.data && options.detectPull) {
      return;
    }
    const pull = pullResponse.data;

    // get the branch
    var getBranchResponse = await context.github.repos.getBranch({
      owner: repository.owner.login,
      repo: repository.name,
      branch: headBranch
    });
    const branch = { ...getBranchResponse.data };

    // get the commit
    var getCommitResponse = await context.github.repos.getCommit({
      owner: repository.owner.login,
      repo: repository.name,
      sha: headSha
    });
    const commit = { ...getCommitResponse.data };

    // get the tree
    var getTreeResponse = await context.github.gitdata.getTree({
      owner: repository.owner.login,
      repo: repository.name,
      tree_sha: commit.commit.tree.sha,
      recursive: 1
    });
    const tree = { ...getTreeResponse.data };

    // run checks
    const checkNames = await getChecksToPerform({
      checkRun: checkRun && checkRun.name === 'Ghint: check for pull request' ? undefined : checkRun,
      ghintFile
    });
    if (checkNames.length > 0) {
      runChecks(context, {
        checkRun: checkRun && checkRun.name === 'Ghint: check for pull request' ? undefined : checkRun,
        checkNames,
        ghintFile,
        headBranch,
        headSha,
        scope: {
          branch,
          commit,
          pull,
          tree
        },
        startTime
      });
    }
  }

  async function runChecks(context, {
    checkRun,
    checkNames,
    ghintFile,
    headBranch,
    headSha,
    scope,
    startTime
  }) {
    let allChecksPassed = true;
    let checksSkipped = 0;
    for (let i = 0; i < checkNames.length; i++) {
      const name = checkNames[i];
      let script = ghintFile.checks[name];
      let message = '';
      // first, if script is an object get script from script.script
      if (typeof script === 'object' && !Array.isArray(script)) {
        if (script.skip === true) {
          checksSkipped++;
          continue;
        }
        message = script.message || message;
        script = script.script || 'false';
        // if message is an array, join them
        if (Array.isArray(message)) {
          message = message.join("\n");
        }
      }
      // if script is an array, join them
      if (Array.isArray(script)) {
        script = script.filter(line => !!(line.trim())).join("\n");
      }
      // if script is string
      else if (typeof script === 'string') {
        script = `return ${script}`;
      }
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
          text: message,
          title: name
        });
      }
    }
    if (allChecksPassed && !checkRun) {
      postCheckResult(context, {
        name: `All checks passed`,
        conclusion: 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: `All checks passed.`,
        text: `${checksSkipped === 0 ? "No" : checksSkipped} check${checksSkipped < 2 ? " was" : "s were"} skipped.`,
        title: `All checks passed`
      });
    }
  }
  async function checkPull(context, {checkRun, headBranch, headSha, options, pull, repository, startTime}) {
    let response = {};
    if (pull) {
      response = await context.github.pullRequests.get({
        owner: repository.owner.login,
        repo: repository.name,
        number: pull.number
      });
    }
    const name = 'Ghint: check for pull request'; // if u change this here, change it somewhere above (Ctrl+F)
    if ((!response.data && options.detectPull) || (checkRun && checkRun.name === name)) {
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
          : `The check '${name}' ${!response.data ? 'failed' : 'passed'}.`,
        text:
          !response.data
          ? 'If a code commit was made before a pull request was created ' +
          'then this check will fail. After a pull request is created you can ' +
          're-run this check. If it\'s still failing you may want to wait a ' +
          'few seconds before re-running it.'
          : 'The pull request has been detected successfully.',
        title: name
      });
    }
    return response;
  }
  async function checkGhintFile(context, {checkRun, headBranch, headSha, repository, startTime}) {
    const response = await utils.getGhintFile(repository.owner.login, repository.name, headBranch);
    const name = 'Ghint: check for .ghint file';
    if (!response.data || (checkRun && checkRun.name === name)) {
      postCheckResult(context, {
        name,
        conclusion: !response.data ? 'failure' : 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: response.error ? response.error.message : `The check '${name}' passed.`,
        // text: "There's supposed to be a .ghint file in the root directory",
        title: name
      });
    }
    return response;
  }

  async function getChecksToPerform({ checkRun, ghintFile }) {
    if (ghintFile.checks) {
      let checkNames = Object.keys(ghintFile.checks);
      if (checkRun) {
        let checkNameToReRun = checkNames.find(name => name === checkRun.name);
        if (checkNameToReRun) {
          checkNames = [checkNameToReRun];
        } else {
          checkNames = [];
        }
      }
      return checkNames;
    }
    return [];
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
