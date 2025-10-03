# oz
(What would it sound like if you pronounced "aws" as a word instead of saying the letters?)

**⚠️ NOTE:** This tool is built for my specific development workflow. Your mileage may vary.

Some [AWS CLI](https://aws.amazon.com/cli/) macros.

## Prerequisites
[Install AWS CLI and configure aws profiles.](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html#cli-configure-sso-prereqs)

Run to confirm:
```sh
aws --version && aws configure list-profiles
```

## Installation
```sh
brew install vi5tar/tap/oz
```
Follow instructions in "Caveats". Example:
```sh
echo "source /opt/homebrew/opt/oz/libexec/oz.sh" >> ~/.zprofile
```

### What's with the extra step?
This CLI ships with a wrapper (oz.sh) to handle env variables. Without it env vars could not be set in your terminal.

## Usage
### Authenticate current terminal session
```sh
oz login
```
The default behavior is to set the `AWS_PROFILE` env var. Alternatively you can set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, and `AWS_CREDENTIAL_EXPIRATION` by passing `--export creds`

### Env vars
List env vars and their current values this tool sets:
```sh
oz env print
```

Clear env vars this tool sets:
```sh
oz env clear
```

### Cognito
**⚠️ DISCLAIMER:** Current implementation is specific to the CUSTOM_AUTH flow of the cognito pools I interact with most.

Get tokens from a Cognito pool:
```sh
oz cognito login
```