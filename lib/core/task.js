const path = require('path')
const utils = require('../utils')

module.exports = class Task {
  constructor () {
    this.params = {}
  }
  /**
   * Run a task
   *
   * @param {string} task Task name
   * @param {object} ctx Context
   * @returns
   */
  async run (task, ctx) {
    ctx.logger.debug('About to execute task:', task)

    // Environment
    let type = 'local'
    if (ctx.mode.template) {
      type = 'template'
    } else if (ctx.mode.global) {
      type = 'global'
    }

    const taskInfo = await this.get(task.name, type, ctx)
    if (!taskInfo) {
      return ctx.logger.error(`Error: Task \`${task.name}\` not found.`)
    }

    // Save params
    const taskName = taskInfo.name
    if (!this.params[taskName]) {
      this.params[taskName] = task.params
    } else if (Array.isArray(this.params[taskName])) {
      this.params[taskName].push(task.params)
    } else {
      this.params[taskName] = [this.params[taskName]].concat(task.params)
    }

    ctx.logger.debug(
      `Task info found:${taskInfo ? '\n' : ' '}${JSON.stringify(
        taskInfo,
        null,
        2
      )}`
    )

    if (ctx.options.template) {
      ctx.logger.log(
        `Using template '${ctx.options.template.name}${
          ctx.options.template.version ? '@' + ctx.options.template.version : ''
        }'`
      )
    }

    ctx.logger.info(
      `Running ${taskInfo.type} task ${utils.style.bold(taskInfo.name)}...`
    )

    let paramsString = ''
    if (task.params) {
      Object.keys(task.params).map(p => {
        paramsString += ` ${p}=${task.params[p]}`
        return false
      })
    }

    if (paramsString) {
      ctx.logger.log(`Task Params:${paramsString}`)
    }

    ctx.nodeModulesPaths = [utils.path.cwd('node_modules')]
    if (ctx.options.template && ctx.stores[ctx.options.template.name]) {
      ctx.nodeModulesPaths.push(
        path.join(ctx.stores[ctx.options.template.name].path, 'node_modules')
      )
    }
    if (taskInfo.type === 'global') {
      ctx.nodeModulesPaths.push(
        path.join(
          ctx.configs._DATA_ROOT,
          ctx.configs.TASK_PREFIX + taskInfo.name,
          'node_modules'
        )
      )
    }

    // Set context, and add them to global
    const context = {
      ctx,
      fbi: ctx
    }
    Object.assign(global, context)

    // Add cwd() and template's node_modules to node path
    process.env.NODE_PATH = ctx.nodeModulesPaths.join(path.delimiter)
    require('module').Module._initPaths()
    try {
      const useTask = require(taskInfo.path)
      if (typeof useTask === 'function') {
        await useTask()
      }
      ctx.logger.success(`🎉  Task \`${taskInfo.name}\` done.`)
    } catch (err) {
      ctx.logger.error(`❗  Task \`${taskInfo.name}\` error`)
      ctx.logger.error(err)
    }
  }

  /**
   * Get task info
   *
   * @param {string} _name Task name
   * @param {string} type Task type
   * @param {object} ctx Context
   * @returns
   */
  async get (_name, type, ctx) {
    // Fina real name
    const name = this.getFullName(_name, ctx.options.tasks)
    if (!name) {
      return null
    }

    let found

    // Find in local
    if (type === 'local') {
      const taskfile = path.join(
        utils.path.cwd(ctx.configs.TEMPLATE_TASKS, name + '.js')
      )
      if (taskfile && (await utils.fs.exist(taskfile))) {
        found = {
          name,
          type: 'local',
          path: taskfile
        }
      }

      if (
        ctx.options.template &&
        ctx.options.template.name.startsWith(ctx.configs.TASK_PREFIX)
      ) {
        // Is task template, find task main file
        try {
          const taskPkg = require(utils.path.cwd('package.json'))
          const mainFile = taskPkg.main
          const mainFilePath = mainFile ? utils.path.cwd(mainFile) : ''
          const mainFileExist = mainFilePath
            ? await utils.fs.exist(mainFilePath)
            : false
          if (mainFileExist) {
            const name = Object.keys(ctx.options.tasks)[0]
            found = {
              name,
              type: 'local',
              path: mainFilePath
            }
          }
        } catch (err) {}
      }
    }

    // Find in templates
    if (!found && ctx.options.template && ctx.options.template.name) {
      const tmplObj = ctx.stores[ctx.options.template.name]
      if (tmplObj) {
        const taskfile = path.join(
          tmplObj.path,
          ctx.configs.TEMPLATE_TASKS,
          name + '.js'
        )
        if (tmplObj && (await utils.fs.exist(taskfile))) {
          found = {
            name,
            type: 'template',
            path: taskfile,
            tmpl: ctx.options.template.name,
            tmplVer: ctx.options.template.version || tmplObj.version.latest
          }
        }
      }
    }

    // Find in global
    if (!found || type === 'global') {
      const taskObj = ctx.stores[ctx.configs.TASK_PREFIX + name]
      if (taskObj) {
        const taskfile = path.join(taskObj.path, taskObj.file)
        if (await utils.fs.exist(taskfile)) {
          found = {
            name,
            type: 'global',
            path: taskfile
          }
        }
      }
    }

    return found
  }

  /**
   * Get all tasks's info
   *
   * @param {object} configs FBI configs
   * @param {object} options User options
   * @param {object} stores Templates store
   * @returns
   */
  async all (configs, options, stores) {
    const _tasks = {
      local: [],
      global: [],
      template: []
    }

    // Local folder
    _tasks.local = await this.findTasks(
      utils.path.cwd(configs.TEMPLATE_TASKS),
      options
    )
    if (
      options.template &&
      options.template.name.startsWith(configs.TASK_PREFIX)
    ) {
      // Is task template, find task main file
      try {
        const taskPkg = require(utils.path.cwd('package.json'))
        const mainFile = taskPkg.main
        if (mainFile) {
          const mainFilePath = utils.path.cwd(mainFile)
          if (await utils.fs.exist(mainFilePath)) {
            const name = Object.keys(options.tasks)[0]
            _tasks.local.push({
              name,
              alias: options.tasks[name].alias || '',
              desc: taskPkg.description || ''
            })
          }
        }
      } catch (err) {}
    }

    // Template folder
    if (options.template && options.template.name && stores) {
      const taskObj = stores[options.template.name]
      if (taskObj) {
        const tmplTaskFolder = path.join(taskObj.path, configs.TEMPLATE_TASKS)
        _tasks.template = await this.findTasks(tmplTaskFolder, options)
      }
    }

    // global tasks
    if (stores) {
      Object.keys(stores).map(item => {
        if (item.startsWith(configs.TASK_PREFIX)) {
          const name = item.replace(configs.TASK_PREFIX, '')
          _tasks.global.push({
            name,
            alias: this.getAliasByName(name, options.tasks),
            desc: stores[item].description || '',
            version: stores[item].version.current || ''
          })
        }
        return false
      })
    }

    return _tasks
  }

  /**
   * Run tasks in parallel mode
   *
   * @param {array} tasks Tasks to run
   * @param {object} ctx Context
   */
  runInParallel (tasks, ctx) {
    tasks.map(t => {
      this.run(t, ctx)
      return false
    })
  }

  /**
   * Run tasks in serial mode
   *
   * @param {array} tasks Tasks to run
   * @param {object} ctx Context
   */
  async runInSerial (tasks, ctx) {
    for (const t of tasks) {
      await this.run(t, ctx)
    }
  }

  /**
   * Find tasks in the specified directory
   *
   * @param {string} dir Target directory
   * @param {object} options User options
   * @returns
   */
  async findTasks (dir, options) {
    const tasks = []
    const exist = await utils.fs.exist(dir)
    if (exist) {
      const lists = await utils.fs.list(dir, [], 1)
      lists.map(t => {
        if (utils.type.isTaskFile(t)) {
          const name = path.basename(t, '.js')
          const info =
            options.tasks && options.tasks[name] ? options.tasks[name] : ''
          tasks.push({
            name,
            alias: info ? info.alias : '',
            desc: info ? info.desc : ''
          })
        }
        return false
      })
    }
    return tasks
  }

  /**
   * Find alias by task name
   *
   * @param {string} name Task name
   * @param {array} tasks Tasks
   * @returns
   */
  getAliasByName (name, tasks) {
    if (!name || !tasks) {
      return ''
    }
    return tasks[name] ? tasks[name].alias : ''
  }

  /**
   * Get the full name of a task
   *
   * @param {string} str
   * @param {array} tasks Tasks
   * @returns
   */
  getFullName (str, tasks) {
    if (!str || !tasks) {
      return str
    }

    if (tasks[str]) {
      return str
    }

    let taskName
    for (const name of Object.keys(tasks)) {
      if (tasks[name].alias === str) {
        taskName = name
        break
      }
    }

    return taskName || str
  }

  /**
   * Get task params
   * Usage:
      const a = ctx.task.getParams()
      const b = ctx.task.getParams('build')
      const c = ctx.task.getParams('build', 't')
   * @param {any} task
   * @param {any} key
   * @returns
   */
  getParams (task, key) {
    if (!task) {
      return this.params
    }
    if (key) {
      return this.params[task] ? this.params[task][key] : null
    }
    return this.params[task]
  }
}
