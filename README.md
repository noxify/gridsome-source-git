# gridsome-source-git

Source plugin for fetching data from a GIT repository.
This source is based on the `@gridsome/source-filesystem` and includes
all functionality which is available in the `@gridsome/source-filesystem`.

This is a port from Gatsby: https://github.com/stevetweeddale/gatsby-source-git
But extended to enable the clone of private git repositories.

## Table of contents

- [gridsome-source-git](#gridsome-source-git)
  - [Table of contents](#table-of-contents)
  - [Install](#install)
  - [How to use](#how-to-use)
  - [Configuration](#configuration)
    - [Remote URL format](#remote-url-format)
  - [Routes](#routes)
  - [Supported provider](#supported-provider)
  - [Supported Repository types](#supported-repository-types)
  - [Access to private repositories](#access-to-private-repositories)
    - [How to generate a personal access token](#how-to-generate-a-personal-access-token)
  - [Examples](#examples)
    - [Public repository](#public-repository)
    - [Private repository](#private-repository)
  - [Credits](#credits)

## Install

```bash
npm install --s @noxify/gridsome-source-git
```

## How to use

```js
module.exports = {
  plugins: [
    {
      use: '@noxify/gridsome-source-git',
      options: {
        remote: 'https://github.com/noxify/test.git',
        target: 'git-source/noxify-test/',
        typeName: 'GitPost',
        route: '/gitpost/:id'
      }
    }
  ]
}
```

## Configuration

| Name                 | Type      | Description                                                            | Default     |
|----------------------|-----------|------------------------------------------------------------------------|-------------|
| remote               | `String`  | Url to the repository                                                  | `null`      |
| target               | `String`  | Defines the url to the remote git                                      | `null`      |
| branch               | `String`  | Defines the branch which should be used.                               | `null`      |
| pattern              | `Array`   | Defines which files should be imported. Multiple patterns are allowed. | `['**/*']`  |
| privateRepo          | `Boolean` | Defines the path where the remote files should be saved.               | `null`      |
| credentials          | `Object`  | Defines the credentials to fetch private repository                    | `{}`        |
| credentials.username | `String`  | Username which should be used for the authentication                   | `null`      |
| credentials.token    | `String`  | Access Token which should be used for the authentication               | `null`      |
| typeName             | `String`  | Defines the GraphQL type name                                          | `GitNode`   |
| baseDir              | `String`  | Check @gridsome/source-filesystem docs                                 | `null`      |
| route                | `String`  | Check @gridsome/source-filesystem docs                                 | `null`      |
| pathPrefix           | `String`  | Check @gridsome/source-filesystem docs                                 | `null`      |
| index                | `String`  | Check @gridsome/source-filesystem docs                                 | `['index']` |
| refs                 | `String`  | Check @gridsome/source-filesystem docs                                 | `{}`        |

### Remote URL format

Please use always the following format for your remote url.

| Provider  | Format                                            |
|-----------|---------------------------------------------------|
| Github    | `https://github.com/<username>/<reponame>.git`    |
| GitLab    | `https://gitlab.com/<username>/<reponame>.git`    |
| BitBucket | `https://bitbucket.org/<username>/<reponame>.git` |

## Routes

Since gridsome 0.7.7 you can define your routes via templates.
Detailed introductions can be found here: (https://gridsome.org/docs/templates/)

## Supported provider

We have tested the plugin with:

* Github
* GitLab
* Bitbucket

## Supported Repository types

The source plugin supports `public` and `private` repositories.

## Access to private repositories

1. Create a new personal access token
2. Add `privateRepo` to your source definition and set it to `true`
3. Add `credentials.username` and `credentials.token` to your source definition ( Please check also the [Examples section](#examples) )

### How to generate a personal access token

* Github: https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line
* Gitlab: https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html
* Bitbucket: https://confluence.atlassian.com/bitbucket/app-passwords-828781300.html



## Examples

### Public repository

```
module.exports = {
  siteName: 'Gridsome',
  plugins: [
    {
      use: '~/plugins/gridsome-source-git',
      options: {
        name: 'public-github',
        remote: 'https://github.com/noxify/gridsome-source-git-public-test.git',
        target: 'git-source/github/public/',
        typeName: 'PublicGithub'
      }
    }
  ]
}
```

### Private repository

```
module.exports = {
  siteName: 'Gridsome',
  plugins: [
    {
      use: '~/plugins/gridsome-source-git',
      options: {
        remote: 'https://github.com/noxify/gridsome-source-git-private-test.git',
        target: 'git-source/github/private/',
        privateRepo: true,
        credentials: {
          username: '<github username>',
          token: '<github personal access token>'
        },
        typeName: 'PrivateGithub'
      }
    }
  ]
}
```

## Credits

Special thanks goes to

* https://isomorphic-git.org/en/
* https://github.com/stevetweeddale
* https://github.com/gridsome
