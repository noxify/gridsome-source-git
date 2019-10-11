# gridsome-source-git

Source plugin for fetching data from a GIT repository.
This source is based on the `@gridsome/source-filesystem` and includes
all functionality which is available in the `@gridsome/source-filesystem`.

This is a port from Gatsby: https://github.com/stevetweeddale/gatsby-source-git

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
        name: 'noxify-test',
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

| Name       | Type     | Description                                                                                                                              | Default     |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| typeName   | `string` | See [@gridsome/source-filesystem docs](https://github.com/gridsome/gridsome/blob/master/packages/source-filesystem/README.md#typename)   | `GitNode`   |
| remote     | `string` | Defines the url to the remote git repository                                                                                             | `null`      |
| branch     | `string` | Defines the branch which should be used to fetch the data. If not defined, it will use the default branch from the repository.           | `null`      |
| target     | `string` | Defines the path where the remote should be saved. Startpoint is the project root.                                                       | `null`      |
| pattern    | `array`  | Defines which files should be imported. Multiple patterns are allowed.                                                                   | `['**/*']`  |
| baseDir    | `string` | See [@gridsome/source-filesystem docs](https://github.com/gridsome/gridsome/blob/master/packages/source-filesystem/README.md#basedir)    | `null`      |
| route      | `string` | See [@gridsome/source-filesystem docs](https://github.com/gridsome/gridsome/blob/master/packages/source-filesystem/README.md#route)      | `null`      |
| pathPrefix | `string` | See [@gridsome/source-filesystem docs](https://github.com/gridsome/gridsome/blob/master/packages/source-filesystem/README.md#pathprefix) | `null`      |
| index      | `array`  | See [@gridsome/source-filesystem docs](https://github.com/gridsome/gridsome/blob/master/packages/source-filesystem/README.md#index)      | `['index']` |
| refs       | `Object` | See [@gridsome/source-filesystem docs](https://github.com/gridsome/gridsome/blob/master/packages/source-filesystem/README.md#refs)       | `{}`        |

## Routes

Since gridsome 0.7.7 you can define your routes via templates.
Detailed introductions can be found here: (https://gridsome.org/docs/templates/)

## Credits

Special thanks goes to

* https://github.com/stevetweeddale
* https://github.com/gridsome
