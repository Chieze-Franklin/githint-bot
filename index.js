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

    // construct the tree object
      // this can help check presence of files (stick to the root directory for now)

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

    // get the .ghapy file
    const ghapyResponse = await checkGhapyFile(context, {
      checkRun,
      headBranch,
      headSha,
      repository,
      startTime
    });
    if (!ghapyResponse.data) {
      return;
    }

    // run commit checks
    const { check: commitCheck, checkNames: commitCheckNames } = await getChecksToPerform({
      checkType: 'commit',
      checkRun,
      ghapyFile: ghapyResponse.data
    });
    if (commitCheckNames && commitCheckNames.length > 0) {
      // get the commit
      var getCommitResponse = await context.github.repos.getCommit({
        owner: repository.owner.login,
        repo: repository.name,
        sha: headSha
      });
      const commit = { ...getCommitResponse.data };
      checkObject(context, {
        checkRun,
        checkType: 'commit',
        check: commitCheck,
        checkNames: commitCheckNames,
        headBranch,
        headSha,
        object: commit,
        startTime
      });
    }

    // run branch checks
    const { check: branchCheck, checkNames: branchCheckNames } = await getChecksToPerform({
      checkType: 'branch',
      checkRun,
      ghapyFile: ghapyResponse.data
    });
    if (branchCheckNames && branchCheckNames.length > 0) {
      // get the branch
      var getBranchResponse = await context.github.repos.getBranch({
        owner: repository.owner.login,
        repo: repository.name,
        branch: headBranch
      });
      const branch = { ...getBranchResponse.data };
      checkObject(context, {
        checkRun,
        checkType: 'branch',
        check: branchCheck,
        checkNames: branchCheckNames,
        headBranch,
        headSha,
        object: branch,
        startTime
      });
    }

    // ge the pr
    let prResponse = {};
    if (ghapyResponse.data.checks && ghapyResponse.data.checks.pr) {
      prResponse = await checkPr(context, {
        checkRun,
        headBranch,
        headSha,
        pr: pullRequests[0],
        repository,
        startTime
      });
    }

    // run pr checks
    const { check: prCheck, checkNames: prcheckNames } = await getChecksToPerform({
      checkType: 'pr',
      // if checkRun exists because PR was not detected, pass undefined
      checkRun: checkRun && checkRun.name === 'Ghapy: check for pull request' ? undefined : checkRun,
      ghapyFile: ghapyResponse.data
    });
    if (prResponse.data && prcheckNames && prcheckNames.length > 0) {
      const pr = { ...prResponse.data };
      checkObject(context, {
        checkRun: checkRun && checkRun.name === 'Ghapy: check for pull request' ? undefined : checkRun,
        checkType: 'pr',
        check: prCheck,
        checkNames: prcheckNames,
        headBranch,
        headSha,
        object: pr,
        startTime
      });
    }
  }

  async function checkObject(context, {
    checkRun,
    checkType,
    check,
    checkNames,
    headBranch,
    headSha,
    object,
    startTime
  }) {
    let allChecksPassed = true;
    for (let i = 0; i < checkNames.length; i++) {
      const name = checkNames[i];
      let script = check[name];
      let message = '';
      // first, if script is an object get script from script.script
      if (typeof script === 'object' && !Array.isArray(script)) {
        message = script.message || message;
        script = script.script;
      }
      // if script is an array, join them
      if (Array.isArray(script)) {
        script = script.join("\n");
      } else if (typeof script === 'string') {
        script = `return (${script})`;
      }
      const scope = {
        [checkType]: object
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
          text: message,
          title: name
        });
      }
    }
    if (allChecksPassed && !checkRun) {
      postCheckResult(context, {
        name: `All ${checkType} checks passed`,
        conclusion: 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: `All ${checkType} checks passed.`,
        // text: "",
        title: `All ${checkType} checks passed`
      });
    }
  }
  async function checkPr(context, {checkRun, headBranch, headSha, pr, repository, startTime}) {
    let response = {};
    if (pr) {
      response = await context.github.pullRequests.get({
        owner: repository.owner.login,
        repo: repository.name,
        number: pr.number
      });
    }
    const name = 'Ghapy: check for pull request'; // if u change this here, change it somewhere above (Ctrl+F)
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
  async function checkGhapyFile(context, {checkRun, headBranch, headSha, repository, startTime}) {
    const response = await utils.getGhapyFile(repository.owner.login, repository.name, headBranch);
    const name = 'Ghapy: check for .ghapy file';
    if (!response.data || (checkRun && checkRun.name === name)) {
      postCheckResult(context, {
        name,
        conclusion: !response.data ? 'failure' : 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: response.error ? response.error.message : `The check '${name}' passed.`,
        // text: "There's supposed to be a .ghapy file in the root directory",
        title: name
      });
    }
    return response;
  }

  async function getChecksToPerform({ checkType, checkRun, ghapyFile }) {
    if (ghapyFile.checks && ghapyFile.checks[checkType]) {
      // const { [checkType]: check } = ghapyFile.checks;
      const check = ghapyFile.checks[checkType];
      let checkNames = Object.keys(check);
      if (checkRun) {
        let checkNameToReRun = checkNames.find(name => name === checkRun.name);
        if (checkNameToReRun) {
          checkNames = [checkNameToReRun];
        } else {
          checkNames = [];
        }
      }
      return ({
        check,
        checkNames
      });
    }
    return ({});
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
