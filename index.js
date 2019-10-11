const path = require('path')
const fs = require('fs-extra')
const slash = require('slash')
const crypto = require('crypto')
const Git = require("simple-git/promise");
const fastGlob = require("fast-glob");
const GitUrlParse = require("git-url-parse");
const mime = require('mime-types');
const {
    _,
    mapValues,
    trim,
    trimEnd
} = require('lodash');

const isDev = process.env.NODE_ENV === 'development'

class GitSource {
    static defaultOptions() {
        return {
            remote: undefined,
            branch: undefined,
            target: undefined,
            pattern:['**/*'],
            baseDir: undefined,
            route: undefined,
            pathPrefix: undefined,
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
        const parsedRemote = GitUrlParse(this.options.remote);
            
        let repo;
        try {
            repo = await this.getRepo(localPath, this.options.remote, this.options.branch);
        } catch (e) {
            console.log(e);
            return [];
        }
        
        parsedRemote.git_suffix = false;
        parsedRemote.webLink = parsedRemote.toString("https");
        delete parsedRemote.git_suffix;
        let ref = await repo.raw(["rev-parse", "--abbrev-ref", "HEAD"]);
        parsedRemote.ref = ref.trim();
        
        const repoFiles = await fastGlob(this.options.pattern, {
            cwd: localPath,
            absolute: false
        });

        return repoFiles;
    }

    async isAlreadyCloned(remote, path) {
        const existingRemote = await Git(path).listRemote(["--get-url"]);
        return existingRemote.trim() == remote.trim();
    }

    async getTargetBranch(repo, branch) {
        if (typeof branch == 'string') {
            return `origin/${branch}`;
        } else {
            return repo.raw(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
        }
    }

    async getRepo(path, remote, branch) {
        // If the directory doesn't exist or is empty
        if (!fs.existsSync(path) || fs.readdirSync(path).length === 0) {
            let opts = ['--depth', '1'];
            if (typeof branch == 'string') {
                opts.push('--branch', branch);
            }

            await Git().clone(remote, path, opts);
            
            return Git(path);
        } else if (await this.isAlreadyCloned(remote, path)) {
            const repo = await Git(path);
            
            const targetBranch = await this.getTargetBranch(repo, branch);
                        
            // Refresh our shallow clone with the latest commit.
            await repo
                .fetch(['--all'])
                .then(() => {
                    repo.reset(['--hard'])
                    repo.checkout(_.trim(targetBranch))
                    repo.pull('--allow-unrelated-histories')
                });
            
            return repo;
        } else {
            throw new Error(`Can't clone to target destination: ${this.options.target}`);
        }
    }
}

module.exports = GitSource