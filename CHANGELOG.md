# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- `/api/repos` endpoint
- `/api/installs` endpoint

## [1.1.0] - 2019-06-24
### Added
- `options` can now have a field called `skip` which can be used to skip (or not skip) all checks
```json
{
    "option": {
        "detectPull": true,
        "skip": true
    }
}
```
This will skip all checks.
- The `skip` for each check overrides this _global_ `skip`.

### Changed
- The `detectPull` and the newly added `skip` fields in `options` (as well as the `skip` for each check) don't have
to hold plain `Boolean` values; they can hold `String` values. If they hold `String` values such values are expected
to be JavaScript code snippets to be executed in the same manner checks are executed. The code snippet for `detectPull`
does not have access to the `pull` object.
```json
{
    "option": {
        "detectPull": "commit.author.login.toLowerCase() !== 'greenkeeper[bot]'",
        "skip": "commit.author.login.toLowerCase() === 'greenkeeper[bot]'"
    }
}
```
This will skip all checks (and not bother detecting a pull request object) is the author of the commit is the
_greenkeeper_ bot.

## [1.0.0] - 2019-06-24
### Added
- Bot is feature-complete and stable.
