const { style } = require('../utils')

/**
 * Usage
 *
 * @param {string} version FBI version
 * @returns
 */
module.exports = version => {
  return `
  ${style.bold('Usage: ')} fbi <command>|<task> [mode] [options]

  ${style.bold('Commands: ')}

    add <repo> [<repo> ...]           Add templates and tasks from remote repositories
    init <tmpl>[@<ver>] [proj] [opts] Create a new project or task based on the specified template
    use <version>                     Specify the template's version for the current local project
    i,  install                       Install dependencies intelligently
    ls, list                          Show all available local templates and tasks
    rm, remove <tmpl>                 Remove local template or task
    up, update <tmpl>                 Update template or task from remote repository
    set [key=value]                   Set FBI configs
    reset                             Reset FBI configs
    -h, --help                        Display help information
    -v, --version                     Display fbi version number

    ${style.grey('Examples:')}
    ${style.italic(style.grey(`$ fbi add https://github.com/fbi-templates/fbi-project-vue.git
    $ fbi init vue [project-name] [-o/-t]
    $ fbi init -o/-t
    $ fbi use 1.1.2
    $ fbi ls [config/store/util]`))}

  ${style.bold('Modes: ')}

    -D, --debug                       Execute fbi in debug mode
    -T, --template                    Execute the task in template mode
    -G, --global                      Execute the task in global mode
    -P, --parallel                    Execute the tasks in parallel mode

    ${style.grey('Examples:')}
    ${style.italic(style.grey(`$ fbi build -D
    $ fbi serve -G
    $ fbi build -T=vue
    $ fbi build build1 build2 build3 -P`))}

  More information  : ${style.blue('https://github.com/neikvon/fbi')}
  Official templates: ${style.blue('https://github.com/fbi-templates')}
`
}
