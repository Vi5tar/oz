#!/usr/bin/env node

import util from 'node:util'
import childProcess, { spawn } from 'node:child_process'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { Command, Option } from 'commander'
import { fromIni } from '@aws-sdk/credential-providers'
import { writeSync } from 'node:fs'
import { select, input } from '@inquirer/prompts'

const exec = util.promisify(childProcess.exec)
const program = new Command()

program.name('oz').description('awscli macros').version('1.0.0-alpha.1')

program
  .command('login')
  .description(
    "Login to AWS with the given profile and sets AWS_PROFILE or AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, and AWS_CREDENTIAL_EXPIRATION. (Doesn't log in again if already logged in.)"
  )
  .option('-p, --profile <string>', 'the aws profile to log in with (~/.aws/config)')
  .addOption(
    new Option('-e, --export <string>', 'which environment variables to export.')
      .choices(['profile', 'creds', 'none'])
      .default('profile')
  )
  .action(async (args) => {
    let { profile } = args

    if (!profile) {
      const { stdout } = await exec('aws configure list-profiles')
      const profiles = stdout.trim().split('\n')

      profile = await select({
        message: 'Select a profile',
        choices: profiles.map((profile) => ({
          name: profile,
          value: profile
        }))
      })
    }

    try {
      const { stdout: region } = await exec(`aws configure get region --profile ${profile}`)

      const stsClient = new STSClient({
        region: region.trim(),
        credentials: fromIni({ profile })
      })

      await stsClient.send(new GetCallerIdentityCommand({}))
    } catch (error) {
      try {
        const awsLogin = spawn('aws', ['sso', 'login', '--profile', profile])
        awsLogin.stdout.on('data', (data) => {
          console.log(data.toString())
        })
        awsLogin.stderr.on('data', (data) => {
          console.log(data.toString())
        })
      } catch ({ stdout, stderr }) {
        console.log(stderr)
        return
      }
    }

    if (args.export === 'profile') {
      writeSync(3, 'unset AWS_ACCESS_KEY_ID\n')
      writeSync(3, 'unset AWS_SECRET_ACCESS_KEY\n')
      writeSync(3, 'unset AWS_SESSION_TOKEN\n')
      writeSync(3, 'unset AWS_CREDENTIAL_EXPIRATION\n')
      writeSync(3, `export AWS_PROFILE=${profile}\n`)
    } else if (args.export === 'creds') {
      writeSync(3, 'unset AWS_PROFILE\n')
      const { stdout } = await exec(
        `aws configure export-credentials --profile ${profile} --format env`
      )
      writeSync(3, stdout)
    } else {
      writeSync(3, 'unset AWS_PROFILE\n')
      writeSync(3, 'unset AWS_ACCESS_KEY_ID\n')
      writeSync(3, 'unset AWS_SECRET_ACCESS_KEY\n')
      writeSync(3, 'unset AWS_SESSION_TOKEN\n')
      writeSync(3, 'unset AWS_CREDENTIAL_EXPIRATION\n')
    }
  })

const envCommand = program.command('env').description('Manage AWS environment variables.')

envCommand
  .command('print')
  .description('print the aws environment variables')
  .action(() => {
    console.log(`AWS_PROFILE=${process.env.AWS_PROFILE ?? ''}`)
    console.log(`AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID ?? ''}`)
    console.log(`AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY ?? ''}`)
    console.log(`AWS_SESSION_TOKEN=${process.env.AWS_SESSION_TOKEN ?? ''}`)
    console.log(`AWS_CREDENTIAL_EXPIRATION=${process.env.AWS_CREDENTIAL_EXPIRATION ?? ''}`)
  })

envCommand
  .command('clear')
  .description('clear the aws environment variables')
  .action(() => {
    writeSync(3, 'unset AWS_PROFILE\n')
    writeSync(3, 'unset AWS_ACCESS_KEY_ID\n')
    writeSync(3, 'unset AWS_SECRET_ACCESS_KEY\n')
    writeSync(3, 'unset AWS_SESSION_TOKEN\n')
    writeSync(3, 'unset AWS_CREDENTIAL_EXPIRATION\n')
  })

const cognitoCommand = program
  .command('cognito')
  .description('Interact with AWS Cognito user pools.')

cognitoCommand
  .command('login')
  .description('login to a cognito user pool')
  .action(async () => {
    let nextToken = null
    let selectedPool = null

    while (!selectedPool) {
      const command = `aws cognito-idp list-user-pools --max-results 10${
        nextToken ? ` --next-token ${nextToken}` : ''
      }`

      const { stdout } = await exec(command, {
        env: {
          ...process.env
        }
      })

      const { UserPools, NextToken } = JSON.parse(stdout)

      const choices = UserPools.map((pool) => ({
        name: pool.Name,
        value: pool.Id
      }))

      if (NextToken) {
        choices.push({
          name: 'Load more...',
          value: NextToken
        })
      } else if (nextToken) {
        choices.push({
          name: 'Start over',
          value: null
        })
      }

      const pool = await select({
        message: 'Select a user pool',
        choices
      })

      if (pool === NextToken) {
        nextToken = NextToken
      } else if (pool === null) {
        nextToken = null
      } else {
        selectedPool = pool
      }
    }

    console.log(`Selected pool ID: ${selectedPool}`)

    nextToken = null
    let selectedClient = null

    while (!selectedClient) {
      const command = `aws cognito-idp list-user-pool-clients --user-pool-id ${selectedPool}`

      const { stdout } = await exec(command, {
        env: {
          ...process.env
        }
      })

      const { UserPoolClients, NextToken } = JSON.parse(stdout)

      const choices = UserPoolClients.map((client) => ({
        name: client.ClientName,
        value: client.ClientId
      }))

      if (NextToken) {
        choices.push({
          name: 'Load more...',
          value: NextToken
        })
      } else if (nextToken) {
        choices.push({
          name: 'Start over',
          value: null
        })
      }

      const client = await select({
        message: 'Select a client',
        choices
      })

      if (client === NextToken) {
        nextToken = NextToken
      } else if (client === null) {
        nextToken = null
      } else {
        selectedClient = client
      }
    }

    console.log(`Selected client ID: ${selectedClient}`)

    const authFlow = await select({
      message: 'Select an authentication flow',
      choices: [
        {
          name: 'CUSTOM_AUTH',
          value: 'CUSTOM_AUTH'
        }
      ]
    })

    console.log(`Selected auth flow: ${authFlow}`)

    const { stdout: defaultUserName } = await exec('git config user.email', {
      env: { ...process.env }
    })

    const userName = await input({
      message: 'Enter a username',
      default: defaultUserName.trim()
    })

    console.log(`Selected username: ${userName}`)

    try {
      console.log('Initiating authentication...')

      const authCommand = `aws cognito-idp admin-initiate-auth --user-pool-id ${selectedPool} --client-id ${selectedClient} --auth-flow ${authFlow} --auth-parameters USERNAME=${userName}`

      let authResult
      try {
        const { stdout } = await exec(authCommand, {
          env: { ...process.env }
        })
        authResult = JSON.parse(stdout)
      } catch (error) {
        if (error.stderr && error.stderr.includes('UserNotFoundException')) {
          console.log('User not found.')

          const createUser = await input({
            message: 'Create user? (y/n)',
            default: 'y',
            validate(input) {
              return input === 'y' || input === 'n'
            }
          })

          if (createUser === 'y') {
            const { stdout: passwordOutput } = await exec(
              'aws secretsmanager get-random-password --password-length 16 --require-each-included-type --output text --query RandomPassword',
              { env: { ...process.env } }
            )
            const randomPassword = passwordOutput.trim().replace(/'/g, "'\"'\"'")

            await exec(
              `aws cognito-idp sign-up --client-id ${selectedClient} --username ${userName} --user-attributes Name=email,Value=${userName} --password '${randomPassword}'`,
              { env: { ...process.env } }
            )

            const { stdout } = await exec(authCommand, {
              env: { ...process.env }
            })
            authResult = JSON.parse(stdout)
          } else {
            process.exit(0)
          }
        } else {
          throw error
        }
      }

      const authCode = await input({
        message: 'Enter verification code:'
      })

      const challengeCommand = `aws cognito-idp respond-to-auth-challenge --client-id ${selectedClient} --challenge-name ${authResult.ChallengeName} --session ${authResult.Session} --challenge-responses USERNAME="${authResult.ChallengeParameters.USERNAME}",email="${authResult.ChallengeParameters.email}",ANSWER="${authCode}"`

      const { stdout: challengeResponse } = await exec(challengeCommand, {
        env: { ...process.env }
      })

      authResult = JSON.parse(challengeResponse)

      console.log(JSON.stringify(authResult, null, 2))
    } catch (error) {
      console.error('Authentication failed:', error.message)
      if (error.stderr) {
        console.error('AWS CLI Error:', error.stderr)
      }
      process.exit(1)
    }
  })

program.parse()
