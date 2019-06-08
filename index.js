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

    // construct the commit object
    // construct the PR object
    // run each check
      // report each check that fails
      // if no check failed report all checks passed
    // consider giving users the power to specify the shape of the PR object

    // const cc = {...context}
    // delete cc.payload;
    // console.log(cc.github.pullRequests)

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
      head_commit: headCommit,
      head_sha: headSha
    }
    = checkSuite;
    // console.log(checkSuite.pull_requests)

    if (headCommit) {
      var gg = await context.github.repos.getCommit({
        owner: repository.owner.login,
        repo: repository.name,
        sha: headCommit.id
      });
      //console.log(gg.data.commit)
    }

    // get the .prlint file
    const prlintResponse = await utils.getPrlintFile(repository.owner.login, repository.name, headBranch);
    if (prlintResponse.error) {
      postCheckResult(context, {
        name: 'Check for .prlint file',
        conclusion: 'failure',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: prlintResponse.error.message,
        // text: "There's supposed to be a .prlint file in the root directory",
        title: 'Check for .prlint file'
      });
    } else {
      postCheckResult(context, {
        name: 'Check for .prlint file',
        conclusion: 'success',
        headBranch,
        headSha,
        startTime,
        status: 'completed',
        summary: "The test 'Check for .prlint file' succeeded.",
        // text: "There .prlint file was successfully found in the root directory",
        title: 'Check for .prlint file'
      });
    }

    // run checks
    if (checkRun) {
      //
    } else {
      // run all tests
    }
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
