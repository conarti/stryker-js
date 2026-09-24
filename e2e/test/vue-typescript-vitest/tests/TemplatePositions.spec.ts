import { mount } from '@vue/test-utils';
import TemplatePositions from '../src/TemplatePositions.vue';
import { expect, describe, it } from 'vitest';

function mountPositions(start = 0) {
  return mount(TemplatePositions, {
    props: { title: 'Pokedex', start, items: ['a', 'b', 'c', 'd'] },
  });
}

describe('TemplatePositions component', () => {
  it('should render the interpolated title', () => {
    const sut = mountPositions();
    expect(sut.find('.title').text()).eq('POKEDEX');
    sut.unmount();
  });
  it('should render neither branch for zero', () => {
    const sut = mountPositions();
    expect(sut.find('.positive').exists()).false;
    expect(sut.find('.negative').exists()).false;
    sut.unmount();
  });
  it('should render the positive branch after a click', async () => {
    const sut = mountPositions();
    await sut.find('button').trigger('click');
    expect(sut.find('.positive').exists()).true;
    expect(sut.find('.negative').exists()).false;
    sut.unmount();
  });
  it('should render the negative branch for a negative start', () => {
    const sut = mountPositions(-1);
    expect(sut.find('.negative').exists()).true;
    sut.unmount();
  });
  it('should use the singular for one item', () => {
    const sut = mountPositions(1);
    expect(sut.find('.amount').text()).eq('item');
    sut.unmount();
  });
  it('should use the plural for two items', () => {
    const sut = mountPositions(2);
    expect(sut.find('.amount').text()).eq('items');
    sut.unmount();
  });
  it('should render the first three items only', () => {
    const sut = mountPositions();
    expect(sut.findAll('li').map((item) => item.text())).deep.eq([
      'a',
      'b',
      'c',
    ]);
    sut.unmount();
  });
  /* `v-show` and `:class` are not asserted on purpose, their mutants survive */
});
