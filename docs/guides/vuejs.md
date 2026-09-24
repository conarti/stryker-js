---
title: VueJS
custom_edit_url: https://github.com/stryker-mutator/stryker-js/edit/master/docs/guides/vuejs.md
---

Stryker supports Vue projects. It can mutate both your js/ts files as the script tags in your `*.vue` files.

This article will explain how to configure Stryker with [vue](https://vuejs.org/guide/quick-start.html).

To get started using Stryker with vue, first install the core package: `npm i -D @stryker-mutator/core` or `yarn add --dev @stryker-mutator/core`. Next follow the guide for the Vitest runner.

Keep in mind that you may have to change some configuration settings such as paths to files.

## `<script setup>` support

For a single file component that uses [`<script setup>`](https://vuejs.org/api/sfc-script-setup.html), Stryker places its instrumentation header in a module level `<script>` block rather than inside the `<script setup>` block. When the file doesn't already have a plain `<script>` block, Stryker creates one and copies the `lang` of the `<script setup>` block onto it.

This only happens when a mutant is placed inside an argument of a Vue compiler macro (`defineProps`, `defineEmits`, `defineOptions`, `defineModel`, `defineSlots` or `withDefaults`), or inside the template (see [Template mutation](#template-mutation)). Every other file keeps the exact same output it had before. The reason is that the Vue compiler hoists a macro argument out of `setup()`, so helpers declared inside `<script setup>` (including Stryker's own instrumentation helpers) are no longer reachable from it. See [#6178](https://github.com/stryker-mutator/stryker-js/issues/6178) for more information.

Adding a plain `<script>` block also turns off Vue's static hoisting of literals in the generated code. This changes the generated code, not the behavior of your component.

The string literal that names a model, e.g. `defineModel('name')`, is never mutated. It shows up as ignored in your report, because the Vue compiler reads that literal statically to derive the prop and event names, and mutating it would rename the model instead of testing anything.

A macro call written as a statement of its own, like `defineProps<Props>();`, is never removed by the `CallExpression` mutator. That mutant shows up as ignored in your report, since the Vue compiler would no longer recognize the macro. The mutants inside its arguments are still tested.

A `<script setup>` block with a `src` attribute, or with a `lang` Stryker doesn't recognize, is skipped and keeps the behavior it had before.

## Template mutation

Stryker also mutates the expressions inside the `<template>` block of a single file component. This has three requirements:

- Vue 3.4 or newer. Stryker loads `vue/compiler-sfc` from the root of your project (the directory you run Stryker from), so the version your project compiles with is the one that is used.
- The component uses `<script setup>`. The template of a component that only has a plain `<script>` block (Options API or `defineComponent`) is not mutated.
- The template is plain html. A template with a `lang` other than `html` (for example `pug`) or with a `src` attribute is not mutated.

### What is mutated

The following positions are mutated with the regular mutators, the same ones that mutate your scripts:

- interpolations, `{{ expression }}`
- `v-if`, `v-else-if` and `v-show`
- `v-html` and `v-text`
- `v-bind` with a static argument, in full (`v-bind:title`) and short (`:title`) notation, including `:class` and `:style` and object literals such as `:class="{ active: isActive }"`
- the source of `v-for`, the `items` in `v-for="item in items"`
- `v-on` with a static argument, in full (`v-on:click`) and short (`@click`) notation, including modifiers such as `.prevent` or `.enter`

### What is skipped

These positions are never mutated:

- `v-model`
- `:key` and `:ref`
- custom directives, such as `v-focus="value"`, and every other directive not listed above, such as `v-slot`
- `v-bind` and `v-on` without an argument, such as `v-bind="attributes"` and `v-on="{ click: handler }"`
- `v-bind` and `v-on` with a dynamic argument, such as `:[name]="value"` and `@[event]="handler"`
- the same name shorthand of `v-bind`, such as `:title` without a value
- the aliases of `v-for`, the `item` in `v-for="item in items"`
- everything inside an element with `v-pre`
- an expression that contains an html entity, such as `&amp;`, or an attribute value without quotes
- an inline `v-on` handler with more than one statement, such as `@click="count++; save()"`
- a handler of a `<Transition>` or `<TransitionGroup>` that refers to a function, such as `@after-enter="onAfterEnter"` (see below)

Comments to disable mutants, such as `<!-- Stryker disable next-line all -->`, are not supported inside the template. They only work in the script blocks, see [Disable mutants](../disable-mutants.md).

### Warnings

When a template cannot be mutated as a whole, Stryker logs a warning with the reason and mutates the script blocks of that file as usual. Reasons are a missing or too old `vue/compiler-sfc`, a file the compiler reports errors for, a template in another language and a template loaded with `src`. A component without `<script setup>` is skipped without a warning.

When some expressions of a template are skipped because of their content (an html entity, a missing quote, an expression Stryker cannot parse, a handler with more than one statement or a function handler of a transition), Stryker logs one warning per file with the number of skipped expressions. Run with `--logLevel debug` to see which expressions they are and why.

The positions in the skipped list above are left out silently, they are not errors.

### Event handlers

Vue decides how to call a `v-on` handler by the text of its expression. `@click="submit"` and `@click="form.submit"` refer to a function that Vue calls with the event, `@click="() => count++"` is a function that Vue calls as it is and `@click="count++"` is an inline statement that Vue wraps in a function of its own. Placing a mutant around such an expression as a whole would change how Vue treats it, and the handler would no longer be called, even without an active mutant. Stryker prevents this:

- For a function expression, only the body of the function is mutated.
- For an inline statement, the whole expression can be mutated, because Vue treats the mutated expression as an inline statement as well.
- For a handler that refers to a function (`submit`, `form.submit`, `form?.submit`, `form!.submit`), Stryker places the mutants inside a wrapper, `(...args) => form.submit(...args)`, and never around the reference itself. The wrapper only ends up in the instrumented code when a mutant is placed inside it. None of the regular mutators changes such a reference, so with the regular mutators these handlers produce no mutants at all and no wrapper.

The wrapper behaves like the handler Vue generates itself, with three differences:

1. `this` and `Function.length`. The wrapper always calls the function on its object (`this` is `form` for `form.submit`) and its `Function.length` is always `0`. On a regular element this is exactly what Vue does on its own, because Vue caches such a handler as `(...args) => form.submit && form.submit(...args)`. Vue does not cache, and passes the function itself, in these cases: a handler on a component, a handler that refers to a variable of the template scope (for example the `item` of a `v-for`), a constant expression, and an element with `v-once`. There Vue calls the function without an object, so `this` is `undefined` and `Function.length` is the number of parameters it declares. Once wrapped, `this` is the object and `Function.length` is `0`.
2. `<Transition>` and `<TransitionGroup>` hooks are never wrapped. Vue reads the length of a hook such as `@enter` to decide whether it waits for the `done` callback, so the wrapper would change the transition. Stryker recognizes the tag names `Transition`, `transition`, `TransitionGroup` and `transition-group`, the same ones the Vue compiler knows. A `Transition` imported under another name, or your own component that renders a `Transition`, is not recognized, and its hooks are treated like any other handler on a component.
3. An optional member handler such as `@click="form?.submit"` gets a listener even when `form` is `null` or `undefined`, where Vue itself attaches none. Calling it is safe, the optional chain returns `undefined`, but the presence of the listener can be observed.

### Coverage

With `coverageAnalysis: "perTest"`, a mutant is covered by a test when the mutated expression runs while that test runs, not when the file is imported. This has two consequences, both expected:

- A component mounted outside of a test, for example in `beforeAll` or at the top level of a test file, is rendered before Stryker knows which test is running. Its template mutants are static: `coveredBy` stays empty and Stryker runs all tests for each of them, which is a lot slower. Mount components inside the test, or use `ignoreStatic` to leave static mutants out.
- A mutant in a `v-on` handler is covered when the handler is called, not when the template renders, because it lives inside the body of a function. A handler that no test triggers yields `NoCoverage` mutants, even when the component is mounted and rendered inside a test. This is the same for a handler written as a function and for a handler that refers to a function, where the mutant lives inside the wrapper. Trigger the event in a test, for example with `wrapper.find('button').trigger('click')`, to cover them.

### Cost

Every template mutant adds a few function calls to the expression it is placed in, and these run on every render. An expression inside a `v-for` runs once per item, so its instrumentation runs once per item as well. For most components this adds little to the time of a test run, but a component that renders long lists many times per test will run noticeably slower. More mutants also means more test runs: expect the number of mutants of a component to grow with the number of expressions in its template. The largest cost is usually static mutants, see [Coverage](#coverage).

### `mutate` with line ranges

The [`mutate`](../configuration.md#mutate-string) option with a line range, such as `src/App.vue:10-20`, does not work as expected for `.vue` files: the range is compared with positions relative to each script block or template expression rather than to the file. Mutate whole `.vue` files instead.

## Vitest configuration

1. Install the `@stryker-mutator/vitest-runner` plugin: `npm i -D @stryker-mutator/vitest-runner` or `yarn add --dev @stryker-mutator/vitest-runner`.
1. Create a "stryker.config.json" file that looks like this:
   ```json
   {
     "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
     "testRunner": "vitest",
     "plugins": ["@stryker-mutator/vitest-runner"]
   }
   ```
1. Add this script to your package.json:
   ```json
   {
     "scripts": {
       "test:mutation": "stryker run"
     }
   }
   ```

Now give it a go with `npm run test:mutation` or `yarn test:mutation`.

Please take a look at the [troubleshooting page](../troubleshooting.md) when you run into any problems setting up StrykerJS.
