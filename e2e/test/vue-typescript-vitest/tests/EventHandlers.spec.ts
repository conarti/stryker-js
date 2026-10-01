import { mount, type VueWrapper } from '@vue/test-utils';
import { Transition, toRaw, type VNode } from 'vue';
import EventHandlers from '../src/EventHandlers.vue';
import { expect, describe, it } from 'vitest';

interface Call {
  receiver: unknown;
  args: unknown[];
}

/**
 * Records every call of a handler, including its receiver.
 * The handler declares two parameters, so its own `Function.length` is 2.
 */
function recorder() {
  const calls: Call[] = [];
  function handler(this: unknown, first?: unknown, second?: unknown) {
    calls.push({
      receiver: this,
      args: [first, second].slice(0, arguments.length),
    });
  }
  return { calls, handler };
}

function mountHandlers() {
  const submit = recorder();
  const form = recorder();
  const maybeForm = recorder();
  const select = recorder();
  const handle = recorder();
  const beforeEnter = recorder();
  const formObject = { submit: form.handler };
  const maybeFormObject = { submit: maybeForm.handler };
  const hooks = { beforeEnter: beforeEnter.handler };
  let saved = 0;
  const sut = mount(EventHandlers, {
    props: {
      form: formObject,
      maybeForm: maybeFormObject,
      forms: [formObject],
      hooks,
      selected: 42,
      submit: submit.handler,
      save: async () => {
        saved++;
      },
      select: select.handler,
      handle: handle.handler,
    },
    global: { stubs: { transition: false } },
  });
  return {
    sut,
    submit,
    form,
    maybeForm,
    select,
    handle,
    beforeEnter,
    formObject,
    maybeFormObject,
    hooks,
    saved: () => saved,
  };
}

/* The handler vue attached to the element, the same value its event invoker calls */
function attachedHandler(sut: VueWrapper, selector: string, event: string) {
  const vnode = (sut.find(selector).element as unknown as { __vnode: VNode })
    .__vnode;
  return vnode.props![event] as (...args: unknown[]) => unknown;
}

function findVNode(vnode: VNode, type: unknown): VNode | undefined {
  if (vnode.type === type) {
    return vnode;
  }
  const children = Array.isArray(vnode.children) ? vnode.children : [];
  for (const child of children) {
    const found = findVNode(child as VNode, type);
    if (found) {
      return found;
    }
  }
  return undefined;
}

describe('EventHandlers component', () => {
  it('should call an identifier handler with the event through the handler vue caches', async () => {
    const { sut, submit } = mountHandlers();
    await sut.find('.identifier').trigger('click');
    expect(submit.calls).length(1);
    expect(submit.calls[0].args[0]).instanceOf(Event);
    expect(toRaw(submit.calls[0].receiver as object)).eq(toRaw(sut.props()));
    expect(attachedHandler(sut, '.identifier', 'onClick').length).eq(0);
    sut.unmount();
  });
  it('should call a member handler on its object through the handler vue caches', async () => {
    const { sut, form, formObject } = mountHandlers();
    await sut.find('.member').trigger('click');
    expect(form.calls).length(1);
    expect(toRaw(form.calls[0].receiver as object)).eq(formObject);
    expect(form.calls[0].args[0]).instanceOf(Event);
    expect(attachedHandler(sut, '.member', 'onClick').length).eq(0);
    sut.unmount();
  });
  it('should call an optional member handler on its object through the handler vue caches', async () => {
    const { sut, maybeForm, maybeFormObject } = mountHandlers();
    await sut.find('.optional').trigger('click');
    expect(maybeForm.calls).length(1);
    expect(toRaw(maybeForm.calls[0].receiver as object)).eq(maybeFormObject);
    expect(maybeForm.calls[0].args[0]).instanceOf(Event);
    expect(attachedHandler(sut, '.optional', 'onClick').length).eq(0);
    sut.unmount();
  });
  it('should call a non null member handler on its object through the handler vue caches', async () => {
    const { sut, form, formObject } = mountHandlers();
    await sut.find('.non-null').trigger('click');
    expect(form.calls).length(1);
    expect(toRaw(form.calls[0].receiver as object)).eq(formObject);
    expect(attachedHandler(sut, '.non-null', 'onClick').length).eq(0);
    sut.unmount();
  });
  it('should call an arrow function handler', async () => {
    const { sut } = mountHandlers();
    await sut.find('.arrow').trigger('click');
    expect(sut.find('.count').text()).eq('1');
    expect(attachedHandler(sut, '.arrow', 'onClick').length).eq(0);
    sut.unmount();
  });
  it('should call an async arrow function handler', async () => {
    const { sut, saved } = mountHandlers();
    await sut.find('.async').trigger('click');
    expect(saved()).eq(1);
    expect(attachedHandler(sut, '.async', 'onClick').length).eq(0);
    sut.unmount();
  });
  it('should call an arrow function handler with a block body', async () => {
    const { sut } = mountHandlers();
    await sut.find('.block').trigger('click');
    expect(sut.find('.count').text()).eq('2');
    sut.unmount();
  });
  it('should run an inline update statement', async () => {
    const { sut } = mountHandlers();
    await sut.find('.update').trigger('click');
    expect(sut.find('.count').text()).eq('1');
    expect(attachedHandler(sut, '.update', 'onClick').length).eq(1);
    sut.unmount();
  });
  it('should run an inline call with its own arguments', async () => {
    const { sut, select } = mountHandlers();
    await sut.find('.call').trigger('click');
    expect(select.calls).length(1);
    expect(select.calls[0].args).deep.eq([42]);
    expect(attachedHandler(sut, '.call', 'onClick').length).eq(1);
    sut.unmount();
  });
  it('should pass the event to an inline call', async () => {
    const { sut, handle } = mountHandlers();
    await sut.find('.event').trigger('click');
    expect(handle.calls).length(1);
    expect(handle.calls[0].args[0]).instanceOf(Event);
    sut.unmount();
  });
  it('should run an inline handler with multiple statements', async () => {
    const { sut, select } = mountHandlers();
    await sut.find('.multiple').trigger('click');
    expect(sut.find('.count').text()).eq('1');
    expect(select.calls).length(1);
    sut.unmount();
  });
  it('should call a member handler that refers to the template scope', async () => {
    /* Vue passes this handler as it is written, the wrapper changes `this` and `Function.length`, see the instrumenter integration test */
    const { sut, form } = mountHandlers();
    await sut.find('.scoped').trigger('click');
    expect(form.calls).length(1);
    expect(form.calls[0].args[0]).instanceOf(Event);
    sut.unmount();
  });
  it('should call a member handler behind the prevent modifier', async () => {
    const { sut, form, formObject } = mountHandlers();
    await sut.find('form').trigger('submit');
    expect(form.calls).length(1);
    expect(toRaw(form.calls[0].receiver as object)).eq(formObject);
    expect((form.calls[0].args[0] as Event).defaultPrevented).true;
    expect(attachedHandler(sut, 'form', 'onSubmit').length).eq(1);
    sut.unmount();
  });
  it('should call an identifier handler behind the enter modifier', async () => {
    const { sut, submit } = mountHandlers();
    await sut.find('.enter').trigger('keyup', { key: 'Escape' });
    expect(submit.calls).length(0);
    await sut.find('.enter').trigger('keyup', { key: 'Enter' });
    expect(submit.calls).length(1);
    expect(attachedHandler(sut, '.enter', 'onKeyup').length).eq(1);
    sut.unmount();
  });
  it('should pass a transition hook as it is written', async () => {
    const { sut, beforeEnter, hooks } = mountHandlers();
    const transition = findVNode(sut.vm.$.subTree, Transition)!;
    expect(transition.props!.onBeforeEnter).eq(hooks.beforeEnter);
    expect(sut.find('.transition').exists()).false;
    await sut.find('.toggle').trigger('click');
    expect(sut.find('.transition').exists()).true;
    expect(beforeEnter.calls).length(1);
    expect(beforeEnter.calls[0].receiver).undefined;
    expect(beforeEnter.calls[0].args[0]).instanceOf(Element);
    sut.unmount();
  });
});
