const path = require('path')
const fs = require('fs-extra')
const slash = require('slash')
const Git = require("simple-git/promise");
const fastGlob = require("fast-glob");
const GitUrlParse = require("git-url-parse");
const _ = require('lodash');

const {
    mapValues
} = require('lodash')

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
        this.store = api.store
        this.context = options.baseDir ?
            api.resolve(options.baseDir) :
            api.context
        this.refsCache = {}

        api.loadSource(async () => {
            const importFiles = await this.getRemoteFiles()
            this.createContentTypes()
            await this.createNodes(importFiles)
        })
    }

    createContentTypes() {
        this.refs = this.normalizeRefs(this.options.refs)

        this.contentType = this.store.addContentType({
            typeName: this.options.typeName,
            route: this.options.route
        })

        mapValues(this.refs, (ref, key) => {
            this.contentType.addReference(key, ref.typeName)

            if (ref.create) {
                this.store.addContentType({
                    typeName: ref.typeName,
                    route: ref.route
                })
            }
        })
    }

    async createNodes(files) {
        const glob = require('globby')

        await Promise.all(files.map(async file => {
            const options = await this.createNodeOptions(path.join(this.options.target,file))
            const node = this.contentType.addNode(options)

            this.createNodeRefs(node)
        }))
    }

    async createNodeRefs(node) {
        for (const fieldName in this.refs) {
            const ref = this.refs[fieldName]

            if (ref.create && node[fieldName]) {
                const value = node[fieldName]
                const typeName = ref.typeName

                if (Array.isArray(value)) {
                    value.forEach(value =>
                        this.addRefNode(typeName, fieldName, value)
                    )
                } else {
                    this.addRefNode(typeName, fieldName, value)
                }
            }
        }
    }

    // helpers
    async createNodeOptions(file) {
        const origin = path.join(this.context, file)
        const relPath = path.relative(this.context, file)
        const mimeType = this.store.mime.lookup(file) || `application/x-${path.extname(file).replace('.', '')}`
        const content = await fs.readFile(origin, 'utf8')
        const id = this.store.makeUid(relPath)
        const {
            dir,
            name,
            ext = ''
        } = path.parse(file)
        const routePath = this.createPath({
            dir,
            name
        })

        return {
            id,
            path: routePath,
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

    addRefNode(typeName, fieldName, value) {
        const cacheKey = `${typeName}-${fieldName}-${value}`

        if (!this.refsCache[cacheKey] && value) {
            this.refsCache[cacheKey] = true

            this.store
                .getContentType(typeName)
                .addNode({
                    id: value,
                    title: value
                })
        }
    }

    createPath({
        dir,
        name
    }) {
        const {
            route,
            pathPrefix = '/'
        } = this.options

        if (route) return

        const joinedPath = path.join(pathPrefix, dir)
        const segments = slash(joinedPath)
            .split('/')
            .filter(v => v)
            .map(s => this.store.slugify(s))

        if (!this.options.index.includes(name)) {
            segments.push(this.store.slugify(name))
        }

        return `/${segments.join('/')}`
    }

    normalizeRefs(refs) {
        const {
            slugify
        } = this.store

        return mapValues(refs, (ref, key) => {
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
                ref.route = ref.route || `/${slugify(ref.typeName)}/:slug`
                ref.create = true
            } else {
                ref.create = false
            }

            return ref
        })
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