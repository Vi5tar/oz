import util from 'node:util'
import childProcess from 'node:child_process'
import { Command } from 'commander'
import { select, input } from '@inquirer/prompts'

const exec = util.promisify(childProcess.exec)

export const login = new Command('login')
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
