# gridsome-source-git

Source plugin for fetching data from a GIT repository.
This source is based on the `@gridsome/source-filesystem` and includes
all functionality which is available in the `@gridsome/source-filesystem`.

This is a port from Gatsby: https://github.com/stevetweeddale/gatsby-source-git
But extended to enable the clone of private git repositories.

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

## Documentation

You can find the complete documentation here: https://webstone.info/documentation/gridsome-source-git
