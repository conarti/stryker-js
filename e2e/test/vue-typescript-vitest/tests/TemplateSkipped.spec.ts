import { mount } from '@vue/test-utils';
import TemplateSkipped from '../src/TemplateSkipped.vue';
import { expect, describe, it } from 'vitest';

describe('TemplateSkipped component', () => {
  it('should render the positions that are not mutated', async () => {
    const highlighted: unknown[] = [];
    let focused = 0;
    const sut = mount(TemplateSkipped, {
      props: {
        title: 'skipped title',
        disabled: false,
        attributeName: 'data-state',
        eventName: 'click',
        extraAttributes: { 'data-role': 'skipped' },
        onFocus: () => focused++,
      },
      global: {
        directives: {
          highlight: {
            mounted: (_element, binding) => highlighted.push(binding.value),
          },
        },
      },
    });
    expect(sut.find('div').attributes('data-role')).eq('skipped');
    expect(sut.find('span').attributes('data-state')).eq('filled');
    expect(sut.find('span').attributes('title')).eq('skipped title');
    expect(highlighted).deep.eq([true]);
    await sut.find('input').trigger('focusin');
    expect(focused).eq(1);
    await sut.find('span').trigger('click');
    expect(sut.find('input').element.value).eq('');
    await sut.find('input').setValue('typed');
    expect(sut.find('span').attributes('data-state')).eq('filled');
    sut.unmount();
  });
});
