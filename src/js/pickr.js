/**
 * Flat UI color-picker.
 * @author  Simon Reinisch <toports@gmx.de>
 * @license MIT
 */

// Import styles
import '../scss/pickr.scss';

// Import utils
import * as _ from './lib/utils';
import * as Color from './lib/color';

// Import classes
import {HSVaColor} from './lib/hsvacolor';
import Moveable from './helper/moveable';
import Selectable from './helper/selectable';

class Pickr {

    constructor(opt) {

        // Assign default values
        this.options = Object.assign({
            components: {output: {}},
            default: 'fff',
            position: 'middle',
            showAlways: false,
            appendToBody: false,
            onChange: () => 0,
            onSave: () => 0
        }, opt);

        _.bindClassUnderscoreFunctions(this);

        // Replace element with color picker
        this.inputActive = false;

        this.color = new HSVaColor();
        this.lastColor = new HSVaColor();

        // Initialize picker
        this._buildRoot();
        this._rePositioningPicker();
        this._buildComponents();
        this._bindEvents();

        // Init color and hide
        this.setColor(this.options.default);

        // Select current color
        this._saveColor();
    }

    _buildRoot() {

        // Check if element is selector
        if (typeof this.options.el === 'string') {
            this.options.el = document.querySelector(this.options.el);
        }

        const toReplace = this.options.el;
        const root = create(this.options.components);
        this.root = root;

        // Replace element with actual color-picker
        toReplace.parentElement.replaceChild(root.root, toReplace);

        // Check appendToBody option
        if (this.options.appendToBody) {
            document.body.appendChild(root.app);
        }

        // Check showAlways option
        this.options.showAlways ? root.app.classList.add('visible') : this.hide();
    }

    _buildComponents() {

        // Instance reference
        const inst = this;
        const comp = this.options.components;

        const components = {

            palette: new Moveable({
                element: inst.root.palette.picker,
                wrapper: inst.root.palette.palette,

                onchange(x, y) {
                    const color = inst.color;

                    // Calculate saturation based on the position
                    color.s = Math.round((x / this.wrapper.offsetWidth) * 100);

                    // Calculate the value
                    color.v = Math.round(100 - ((y / this.wrapper.offsetHeight) * 100));

                    const cssRGBaString = color.toRGBA().toString();

                    // Set picker and gradient color
                    this.element.style.background = cssRGBaString;
                    this.wrapper.style.background = `
                        linear-gradient(to top, rgba(0, 0, 0, ${color.a}), transparent), 
                        linear-gradient(to left, hsla(${color.h}, 100%, 50%, ${color.a}), rgba(255, 255, 255, ${color.a}))
                    `;

                    // Change current color
                    inst.root.preview.currentColor.style.background = cssRGBaString;
                    inst._updateOutput();
                }
            }),

            hueSlider: new Moveable({
                lockX: true,
                element: inst.root.hueSlider.picker,
                wrapper: inst.root.hueSlider.slider,

                onchange(x, y) {
                    if (!comp.hue) return;

                    // Calculate hue
                    inst.color.h = Math.round((y / this.wrapper.offsetHeight) * 360);

                    // Update color
                    this.element.style.backgroundColor = `hsl(${inst.color.h}, 100%, 50%)`;
                    components.palette.trigger();
                }
            }),

            opacitySlider: new Moveable({
                lockX: true,
                element: inst.root.opacitySlider.picker,
                wrapper: inst.root.opacitySlider.slider,

                onchange(x, y) {
                    if (!comp.opacity) return;

                    // Calculate opacity
                    inst.color.a = Math.round((y / this.wrapper.offsetHeight) * 1e2) / 1e2;

                    // Update color
                    this.element.style.background = `rgba(0, 0, 0, ${inst.color.a})`;
                    inst.components.palette.trigger();
                }
            }),

            selectable: new Selectable({
                elements: inst.root.input.options,
                className: 'active',
                onchange() {
                    inst.inputActive = false;
                    inst.components.palette.trigger();
                }
            })
        };

        this.components = components;
    }

    _bindEvents() {
        const root = this.root,
            eventBindings = [];

        // Clear color
        eventBindings.push(_.on(root.input.clear, 'click', () => {
            root.button.style.background = 'rgba(255, 255, 255, 0.4)';
            root.button.classList.add('clear');
            this.hide();

            // Fire listener
            this.options.onSave(null, this);
        }));

        // Select last color on click
        eventBindings.push(_.on(root.preview.lastColor, 'click', () => this.setHSVA(...this.lastColor.toHSVA())));

        // Provide hiding / showing abilities only if showAlways is false
        if (!this.options.showAlways) {

            // Save and hide / show picker
            eventBindings.push(_.on(root.button, 'click', () => this.root.app.classList.contains('visible') ? this.hide() : this.show()));

            // Cancel selecting if the user taps behind the color picker
            eventBindings.push(_.on(document, 'mousedown', (e) => {
                if (!_.eventPath(e).includes(root.root)) {
                    _.once(document, 'mouseup', () => this.hide());
                }
            }));
        }

        // Save color
        eventBindings.push(_.on(root.input.save, 'click', () => {
            this._saveColor();
            if (!this.options.showAlways) {
                this.hide();
            }
        }));

        // Detect user input
        eventBindings.push(_.on(root.input.result, 'keyup', (e) => {
            this.setColor(e.target.value);
            this.inputActive = true;
        }));

        // Cancel input detection on color change
        eventBindings.push(_.on([
            root.palette.palette,
            root.palette.picker,
            root.hueSlider.slider,
            root.hueSlider.picker,
            root.opacitySlider.slider,
            root.opacitySlider.picker
        ], 'mousedown', () => this.inputActive = false));

        // Repositioning on resize
        eventBindings.push(_.on(window, 'resize', this._rePositioningPicker));

        // Save bindings
        this.eventBindings = eventBindings;
    }

    _rePositioningPicker() {
        const root = this.root;
        const app = this.root.app;

        // Check appendToBody option and normalize position
        if (this.options.appendToBody) {
            const relative = root.button.getBoundingClientRect();
            app.style.marginLeft = `${relative.left}px`;
            app.style.marginTop = `${relative.top}px`;
        }

        const bb = root.button.getBoundingClientRect();
        const ab = app.getBoundingClientRect();
        const as = app.style;

        // Check if picker is cuttet of from the top & bottom
        if (ab.bottom > window.innerHeight) {
            as.top = `${-(ab.height) - 5}px`;
        } else if (bb.bottom + ab.height < window.innerHeight) {
            as.top = `${bb.height + 5}px`;
        }

        // Positioning picker on the x-axis
        function getLeft(pos) {
            switch (pos) {
                case 'left':
                    return -(ab.width) + bb.width;
                case 'middle':
                    return -(ab.width / 2) + bb.width / 2;
                case 'right':
                    return 0;
            }
        }

        const currentLeft = parseInt(getComputedStyle(app).left, 10);
        let newLeft = getLeft(this.options.position);
        if ((ab.left - currentLeft) + newLeft < 0) {
            newLeft = getLeft('right');
        } else if ((ab.left - currentLeft) - newLeft > window.innerWidth) {
            newLeft = getLeft('left');
        }

        as.left = `${newLeft}px`;
    }

    _updateOutput() {

        // Check if component is present
        if (!this.inputActive && this.root.input.type()) {

            // Update infobox
            this.root.input.result.value = (() => {

                // Construct function name and call if present
                const method = 'to' + this.root.input.type().getAttribute('data-type');

                if (typeof this.color[method] === 'function') {
                    return this.color[method]().toString();
                }

                return '';
            })();
        }

        // Fire listener
        this.options.onChange(this.color, this);
    }

    _saveColor() {

        // User changed the color so remove the clear icon
        this.root.button.classList.remove('clear');

        // Change preview and current color
        const cssRGBaString = this.color.toRGBA().toString();
        this.root.preview.lastColor.style.background = cssRGBaString;
        this.root.button.style.background = cssRGBaString;

        // Save last color
        this.lastColor = this.color.clone();

        // Fire listener
        this.options.onSave(this.color, this);
    }

    /**
     * Destroy's all functionalitys
     */
    destroy() {
        this.eventBindings.forEach(args => _.off(...args));
        Object.keys(this.components).forEach(key => this.components[key].destroy());
    }

    /**
     * Destroy's all functionalitys and removes
     * the pickr element.
     */
    destroyAndRemove() {
        this.destroy();

        // Remove element
        const root = this.root.root;
        root.parentElement.removeChild(root);
    }

    /**
     * Hides the color-picker ui.
     */
    hide() {
        this.root.app.classList.remove('visible');
    }

    /**
     * Shows the color-picker ui.
     */
    show() {
        this.root.app.classList.add('visible');
        this._rePositioningPicker();
    }

    /**
     * Set a specific color.
     * @param h Hue
     * @param s Saturation
     * @param v Value
     * @param a Alpha channel (0 - 1)
     */
    setHSVA(h = 360, s = 0, v = 0, a = 1) {

        // Validate input
        if (h < 0 || h > 360 || s < 0 || s > 100 || v < 0 || v > 100 || a < 0 || a > 1) {
            return false;
        }

        // Short names
        const {hueSlider, opacitySlider, palette} = this.components;

        // Calculate y position of hue slider
        const hueWrapper = hueSlider.options.wrapper;
        const hueY = hueWrapper.offsetHeight * (h / 360);
        hueSlider.update(0, hueY);

        // Calculate y position of opacity slider
        const opacityWrapper = opacitySlider.options.wrapper;
        const opacityY = opacityWrapper.offsetHeight * a;
        opacitySlider.update(0, opacityY);

        // Calculate y and x position of color palette
        const pickerWrapper = palette.options.wrapper;
        const pickerX = pickerWrapper.offsetWidth * (s / 100);
        const pickerY = pickerWrapper.offsetHeight * (1 - (v / 100));
        palette.update(pickerX, pickerY);

        this._updateOutput();
        this.color = new HSVaColor(h, s, v, a);
    }

    /**
     * Trys to parse a string which represents a color.
     * Examples: #fff
     *           rgb 10 10 200
     *           hsva 10 20 5 0.5
     * @param string
     */
    setColor(string) {
        const parsed = Color.parseToHSV(string);
        if (parsed) {
            this.setHSVA(...parsed);
        }
    }

    /**
     * @returns HSVaColor Current HSVaColor object.
     */
    getColor() {
        return this.color;
    }

    /**
     * @returns The root HTMLElement with all his components.
     */
    getRoot() {
        return this.root;
    }
}

function create(o) {
    const hidden = (con) => con ? '' : 'style="display:none" hidden';

    const element = _.createElementFromString(`
          <div class="pickr">
              <div class="pcr-button"></div>
          
              <div class="pcr-app">
                  <div class="pcr-selection">
                      <div class="pcr-color-preview" ${hidden(o.preview)}>
                          <div class="pcr-last-color"></div>
                          <div class="pcr-current-color"></div>
                      </div>
          
                      <div class="pcr-color-palette">
                          <div class="pcr-picker"></div>
                          <div class="pcr-palette"></div>
                      </div>
          
                      <div class="pcr-color-chooser" ${hidden(o.hue)}>
                          <div class="pcr-picker"></div>
                          <div class="pcr-hue pcr-slider"></div>
                      </div>
          
                      <div class="pcr-color-opacity" ${hidden(o.opacity)}>
                          <div class="pcr-picker"></div>
                          <div class="pcr-opacity pcr-slider"></div>
                      </div>
                  </div>
          
                  <div class="pcr-output" ${hidden(o.output)}>
                      <input class="pcr-result" type="text" spellcheck="false" ${hidden(o.output.input)}>
          
                      <input class="pcr-type" data-type="HEX" value="HEX" type="button" ${hidden(o.output.hex)}>
                      <input class="pcr-type" data-type="RGBA" value="RGBa" type="button" ${hidden(o.output.rgba)}>
                      <input class="pcr-type" data-type="HSLA" value="HSLa" type="button" ${hidden(o.output.hsla)}>
                      <input class="pcr-type" data-type="HSVA" value="HSVa" type="button" ${hidden(o.output.hsva)}>
                      <input class="pcr-type" data-type="CMYK" value="CMYK" type="button" ${hidden(o.output.cmyk)}>
          
                      <input class="pcr-save" value="Save" type="button">
                      <input class="pcr-clear" value="Clear" type="button" ${hidden(o.output.clear)}>
                  </div>
              </div>
          </div>
    `);

    const select = (query) => {
        const items = element.querySelectorAll(query);
        return items.length === 0 ? null : items.length === 1 ? items[0] : Array.from(items);
    };

    const root = {
        root: element,

        button: select('.pcr-button'),

        app: select('.pcr-app'),

        input: {
            options: select('.pcr-app .pcr-output .pcr-type'),
            type: () => root.input.options.find(e => e.classList.contains('active')),
            result: select('.pcr-app .pcr-output .pcr-result'),

            save: select('.pcr-app .pcr-output .pcr-save'),
            clear: select('.pcr-app .pcr-output .pcr-clear')
        },

        preview: {
            lastColor: select('.pcr-app .pcr-color-preview .pcr-last-color'),
            currentColor: select('.pcr-app .pcr-color-preview .pcr-current-color')
        },

        palette: {
            picker: select('.pcr-app .pcr-color-palette .pcr-picker'),
            palette: select('.pcr-app .pcr-color-palette .pcr-palette')
        },

        hueSlider: {
            picker: select('.pcr-app .pcr-color-chooser .pcr-picker'),
            slider: select('.pcr-app .pcr-color-chooser .pcr-hue.pcr-slider')
        },

        opacitySlider: {
            picker: select('.pcr-app .pcr-color-opacity .pcr-picker'),
            slider: select('.pcr-app .pcr-color-opacity .pcr-opacity.pcr-slider')
        }
    };

    // Select option which is not hidden
    root.input.options.find(o => !o.hidden && !o.classList.add('active'));
    return root;
}

// Static methods
Pickr.utils = {
    once: _.once,
    on: _.on,
    off: _.off,
    eventPath: _.eventPath,
    createElementFromString: _.createElementFromString
};

// Create instance via method
Pickr.create = (options) => new Pickr(options);

// Export
Pickr.version = '0.1.3';
module.exports = Pickr;