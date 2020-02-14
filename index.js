const path = require('path')
const fs = require('fs-extra')
const slash = require('slash')
const crypto = require('crypto')
const fastGlob = require("fast-glob");
const mime = require('mime-types');
const {
    _,
    mapValues,
    trim,
    trimEnd
} = require('lodash');

const git = require('isomorphic-git');
git.plugins.set('fs', fs)

class GitSource {
    static defaultOptions() {
        return {
            remote: undefined,
            branch: undefined,
            target: undefined,
            pattern: ['**/*'],
            baseDir: undefined,
            pathPrefix: undefined,
            privateRepo: false,
            credentials: {
                username: null,
                token: null
            },
            index: ['index'],
            typeName: 'GitNode',
            refs: {}
        }
    }

    constructor(api, options) {
        this.api = api
        this.options = options
        this.context = options.baseDir ?
            api.resolve(options.baseDir) :
            api.context
        this.refsCache = {}

        api.loadSource(async (actions) => {
            const importFiles = await this.getRemoteFiles()
            this.createCollections(actions)
            await this.createNodes(importFiles, actions)
        })
    }

    createCollections(actions) {

        this.refs = this.normalizeRefs(this.options.refs)

        this.collection = actions.addCollection({
            typeName: this.options.typeName
        })

        mapValues(this.refs, (ref, key) => {
            this.collection.addReference(key, ref.typeName)

            if (ref.create) {
                actions.addCollection({
                    typeName: ref.typeName
                })
            }
        })
    }

    async createNodes(files, actions) {
        const glob = require('globby')

        await Promise.all(files.map(async file => {
            const options = await this.createNodeOptions(path.join(this.options.target, file), actions)
            const node = this.collection.addNode(options)

            this.createNodeRefs(node, actions)
        }))
    }

    // helpers
    async createNodeOptions(file, actions) {
        const relPath = path.relative(this.context, file)
        const origin = path.join(this.context, file)
        const content = await fs.readFile(origin, 'utf8')
        const {
            dir,
            name,
            ext = ''
        } = path.parse(file)
        const mimeType = mime.lookup(file) || `application/x-${ext.replace('.', '')}`

        return {
            id: this.createUid(relPath),
            path: this.createPath({
                dir,
                name
            }, actions),
            fileInfo: {
                extension: ext,
                directory: dir,
                path: file,
                name
            },
            internal: {
                mimeType,
                content,
                origin
            }
        }
    }

    async createNodeRefs(actions, node) {
        for (const fieldName in this.refs) {
            const ref = this.refs[fieldName]

            if (ref.create && node[fieldName]) {
                const value = node[fieldName]
                const typeName = ref.typeName

                if (Array.isArray(value)) {
                    value.forEach(value =>
                        this.addRefNode(actions, typeName, fieldName, value)
                    )
                } else {
                    this.addRefNode(actions, typeName, fieldName, value)
                }
            }
        }
    }

    addRefNode(typeName, fieldName, value, actions) {
        const getCollection = actions.getCollection || actions.getContentType
        const cacheKey = `${typeName}-${fieldName}-${value}`

        if (!this.refsCache[cacheKey] && value) {
            this.refsCache[cacheKey] = true

            getCollection(typeName).addNode({
                id: value,
                title: value
            })
        }
    }

    createPath({
        dir,
        name
    }, actions) {
        const {
            permalinks = {}
        } = this.api.config
        const pathPrefix = trim(this.options.pathPrefix, '/')
        const pathSuffix = permalinks.trailingSlash ? '/' : ''

        const segments = slash(dir).split('/').map(segment => {
            return actions.slugify(segment)
        })

        if (!this.options.index.includes(name)) {
            segments.push(actions.slugify(name))
        }

        if (pathPrefix) {
            segments.unshift(pathPrefix)
        }

        const res = trimEnd('/' + segments.filter(Boolean).join('/'), '/')

        return (res + pathSuffix) || '/'
    }

    normalizeRefs(refs) {
        return mapValues(refs, (ref) => {
            if (typeof ref === 'string') {
                ref = {
                    typeName: ref,
                    create: false
                }
            }

            if (!ref.typeName) {
                ref.typeName = this.options.typeName
            }

            if (ref.create) {
                ref.create = true
            } else {
                ref.create = false
            }

            return ref
        })
    }

    createUid(orgId) {
        return crypto.createHash('md5').update(orgId).digest('hex')
    }

    //Git
    async getRemoteFiles() {
        const localPath = require("path").join(
            this.context,
            this.options.target
        );

        try {
            await this.getRepo(localPath, this.options);
        } catch (e) {
            console.log(e);
            return [];
        }

        const repoFiles = await fastGlob(this.options.pattern, {
            cwd: localPath,
            absolute: false
        });

        return repoFiles;
    }

    async isAlreadyCloned(path) {
        const existingRemote = await git.listRemotes({
            dir: path
        });

        return _.find(existingRemote, {
            url: this.options.remote.trim()
        }) !== undefined;
    }

    async getRepo(path) {

        let repoOptions = {
            dir: path,
        };

        //add credentials to clone a private repo
        if (this.options.privateRepo) {
            repoOptions.username = this.options.credentials.username;
            repoOptions.token = this.options.credentials.token
        }

        //use proxy if defined
        if (this.options.proxy) {
            repoOptions.corsProxy = this.options.proxy;
        }

        let cloneOptions = {
            url: this.options.remote,
            singleBranch: true,
            depth: 1,
            ...repoOptions
        }

        //use defined branch
        if (this.options.branch) {
            cloneOptions.ref = this.options.branch;
        }

        if (!fs.existsSync(path) || fs.readdirSync(path).length === 0) {
            await git.clone(cloneOptions)
        } else if (await this.isAlreadyCloned(path)) {
            const currentBranch = await git.currentBranch({
                dir: path,
                fullname: false
            });

            if (this.options.branch && currentBranch != this.options.branch) {
                currentBranch = this.options.branch;
            }

            repoOptions.ref = currentBranch;

            //source: https://github.com/isomorphic-git/isomorphic-git/issues/129
            fs.unlink(path + '/.git/index', (err) => {
                //if something goes wrong, remove the dir
                //and use `clone` instead of `checkout`
                if (err) {
                    fs.removeSync(path);
                    git.clone(cloneOptions);
                } else {
                    // checkout the branch into the working tree
                    git.checkout(repoOptions);
                }
            });

        } else {
            throw new Error(`Can't clone to target destination: ${this.options.target}`);
        }
    }
}

module.exports = GitSource