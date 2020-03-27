<script>
export default {
    name: 'InputRangeControl',
    replace: true,
    props: {
        /** Размер */
        size: {
            type: String,
            default: 'default',
            validator(value) {
                return ['default', 'small', 'large', 'big', 'huge'].indexOf(value) !== -1;
            },
        },
        /** Блокирование */
        disabled: {
            type: Boolean,
            default: false,
        },
        /** Невалидность */
        hasError: {
            type: Boolean,
            default: false,
        },
        /** Текущее значение */
        value: {
            type: Number,
            default: 0,
        },
        /**
         * Шаги
         *
         * пример для типа 'variable'
         * [{min: 1, max: 10, step: 1}, {min: 11, max: 50, step: 5}];
         */
        steps: {
            type: Array,
            default() {
                return [1, 50, 100];
            },
        },
        /** Единица измерения */
        unit: {
            type: String,
            default: '',
        },

        /** Количество знаков после запятой */
        digitsAfterPoint: {
            type: Number,
            default: 0,
        },

        /** Показывать ли шкалу */
        isStepsVisible: {
            type: Boolean,
            default: true,
        },
    },

    data() {
        this.valueTimeout = null;
        this.lastControlValue = null;
        return {
            controlValue: 1,
            controlMask: null,
            controlMin: 1,
            controlMax: Infinity,

            sliderValue: 1,
            sliderMin: 1,
            sliderMax: Infinity,
            sliderStep: 1,
            sliderBands: [],

            stepsPositions: {},
        };
    },

    computed: {
        /**
         * Обработанное значение для UiInput
         * @return {string}
         */
        inputValue() {
            return String(this.controlValue).replace('.', ',');
        },
    },

    created() {
        const type = this.getType(this.steps);
        this.type = type;

        if (type === 'linear') {
            this.initLinearTypeParams();
        }

        if (type === 'variable') {
            this.initVariableTypeParams();
        }

        this.controlMask = {
            mask: Number,
            min: this.controlMin,
            max: this.controlMax,
            scale: this.digitsAfterPoint,
            signed: false,
            radix: ',',
            mapToRadix: ['.'],
            thousandsSeparator: ' ',
            padFractionalZeros: false,
            normalizeZeros: false,
        };
    },

    ready() {
        this.initSteps({
            width: this.$el.clientWidth,
            type: this.type,
            steps: this.steps,
            bands: this.sliderBands,
        });
    },

    mounted() {
        this.initSteps({
            width: this.$el.clientWidth,
            type: this.type,
            steps: this.steps,
            bands: this.sliderBands,
        });
    },

    methods: {
        /**
         * Инициализировать подписи шкалы
         * @param {number} width
         * @param {string} type
         * @param {Array} steps
         * @param {Array} bands
         */
        initSteps({ width, type, steps, bands }) {
            this.stepsPositions = this.getStepsPositions({ width, type, steps, bands });
            if (this.$onBreakpoint) {
                this.$onBreakpoint([], () => {
                    this.getStepsPositions({ width, type, steps, bands });
                });
            }
        },

        /**
         * Обработка изменения значения слайдера
         * @param {Event} event
         */
        handleSliderChange({ target: { value } }) {
            const { digitsAfterPoint } = this;
            const newValue = digitsAfterPoint ? parseFloat(value) : parseInt(value, 10);

            if (!newValue) {
                return;
            }

            if (newValue === this.lastControlValue) {
                return;
            }

            let newTrueValue = null;

            if (this.sliderBands.length) {
                newTrueValue = this.getTrueControlValue({
                    steps: this.sliderBands,
                    value: newValue,
                    digitsAfterPoint,
                });
            } else {
                newTrueValue = newValue;
            }

            this.sliderValue = newValue;
            this.controlValue = newTrueValue;
            this.lastControlValue = newValue;
            this.emitValue(newTrueValue);
        },

        /**
         * Обработать ввод нового знаения
         * @param {string} value
         */
        handleInput(value) {
            clearTimeout(this.valueTimeout);

            const newValue = this.digitsAfterPoint
                ? parseFloat(value.replace(',', '.'))
                : parseInt(value, 10);

            this.controlValue = newValue;
            this.valueTimeout = setTimeout(() => {
                const { controlMin, controlMax, steps, sliderBands } = this;
                const stepsMax = controlMax || steps[steps.length - 1];
                const stepsMin = controlMin || steps[0];

                if (newValue > stepsMax) {
                    this.controlValue = stepsMax;
                    this.sliderValue = this.getSliderPosition(sliderBands, stepsMax);
                    this.emitValue(stepsMax);
                    return;
                }

                if (newValue < 0) {
                    this.controlValue = stepsMin;
                    this.emitValue(stepsMin);
                    return;
                }

                this.sliderValue = this.getSliderPosition(sliderBands, newValue);
                this.emitValue(newValue);
            }, 300);
        },

        /**
         * Обработка события окончания ввода значения в маску
         * @param {number} newValue
         */
        handleMaskInputComplete(newValue) {
            this.$emit('mask-input-complete', newValue);
        },

        /**
         * Обработка события focus
         * @param {Event} event
         */
        handleFocus(event) {
            this.$emit('focus', event);
        },

        /**
         * Определить тип контролла
         * @param {Array} steps
         * @return {string}
         */
        getType(steps) {
            if (!steps.length || typeof steps[0] === 'number') {
                return 'linear';
            }
            return 'variable';
        },

        /**
         * Инициализировать линейный тип
         * @private
         */
        initLinearTypeParams() {
            const { value, steps } = this;
            const minValue = steps[0];
            const maxValue = steps[steps.length - 1];

            this.controlMin = minValue;
            this.controlMax = maxValue;
            this.controlValue = value || minValue;

            this.sliderMin = minValue;
            this.sliderMax = maxValue;
            this.sliderValue = value || minValue;
        },

        /**
         * Инициализировать переменный тип
         * @private
         */
        initVariableTypeParams() {
            const { value, steps } = this;
            const lastStepIndex = steps.length - 1;
            const firstStep = steps[0];
            const minValue = firstStep.min;

            this.controlMin = minValue;
            this.controlMax = steps[lastStepIndex].max;
            this.controlValue = value || minValue;

            const sliderBands = this.getBandsMap(steps);
            const lastBandIndex = sliderBands.length - 1;
            const maxSliderValue = sliderBands[lastBandIndex].totalStep;

            this.sliderBands = sliderBands;
            this.sliderStep = firstStep.step;
            this.sliderValue = this.getSliderPosition(sliderBands, value);
            this.sliderMin = minValue;
            this.sliderMax = maxSliderValue;
        },

        /**
         * Input: обработка потери фокуса
         * @param {Event} event
         */
        handleBlur(event) {
            const { controlValue, controlMin, steps } = this;
            if (controlValue && controlValue > controlMin) {
                return;
            }

            const minValue = controlMin || steps[0].min;
            this.controlValue = minValue;
            this.sliderValue = minValue;

            this.$emit('blur', event);
            this.emitValue(minValue);
        },

        /**
         * Диапазоны: рассчет необходимых дополнительных данных
         * @param {Array} bands
         * @return {Array}
         */
        getBandsMap(bands) {
            if (!bands.length) {
                return [];
            }

            let bandMin = bands[0].min;
            let bandMax = 0;
            let totalValue = 0;
            let totalStep = 0;
            const bandsMap = [];

            for (let i = 0; i < bands.length; i++) {
                const band = bands[i];
                const index = bands.indexOf(band);
                const bandStep = band.step >= 1 ? band.step : 1;
                const stepsCount = (band.max - band.min + 1) / bandStep;

                if (index > 0) {
                    bandMin = bandMax;
                }

                bandMax += stepsCount;
                totalStep += stepsCount;
                totalValue = band.max;

                bandsMap.push({
                    min: bandMin,
                    max: bandMax,
                    count: stepsCount,
                    stepValue: bandStep,
                    totalValue,
                    totalStep,
                });
            }

            return bandsMap;
        },

        /**
         * Подписи шагов при линейном распределении
         * @param {Array} steps
         * @param {number} sliderWidth
         * @return {Object}
         */
        getMarkingByArray(steps, sliderWidth) {
            if (!Array.isArray(steps) || !sliderWidth) {
                return {};
            }

            const { type } = this;
            const minValue = steps[0];
            const maxValue = steps[steps.length - 1];
            const stepsMap = [{ value: minValue, position: 0 }];

            for (let i = 1; i < steps.length; i++) {
                const value = steps[i];
                if (value === minValue) {
                    // eslint-disable-next-line no-continue
                    continue;
                }
                const stepPosition = this.getStepPosition(type, value, sliderWidth, {
                    maxValue,
                    minValue,
                });
                stepsMap.push({ value, position: stepPosition });
            }

            return stepsMap;
        },

        /**
         * Подписи шагов при нелинейном распределении
         * @param {Array} steps
         * @param {number} sliderWidth
         * @return {Object}
         */
        getMarkingByObject(steps, sliderWidth) {
            if (!Array.isArray(steps) || !sliderWidth) {
                return {};
            }

            const minValue = steps[0].min;
            const maxStepIndex = steps.length - 1;
            const maxValue = steps[maxStepIndex].totalStep;
            const minValueDiff = minValue - 1;

            const stepsArray = [];
            const stepsMap = [];

            stepsMap.push({ value: steps[0].min, position: 0 });

            for (let i = 0; i < steps.length; i++) {
                stepsArray.push(steps[i].totalValue);
            }

            const { type } = this;
            for (let i = 0; i < stepsArray.length; i++) {
                const stepPosition = this.getStepPosition(type, steps[i], sliderWidth, {
                    maxValue,
                    minValueDiff,
                });
                stepsMap.push({ value: stepsArray[i], position: stepPosition });
            }

            return stepsMap;
        },

        /**
         * Получить координату позиции шага в пикселях
         * @param {string} sliderType
         * @param {Object} step
         * @param {number} sliderWidth
         * @param {Object} maxValue, minValue
         * @param {number} minValueDiff
         * @return {number}
         */
        // eslint-disable-next-line consistent-return
        getStepPosition(
            sliderType = 'linear',
            step,
            sliderWidth,
            { maxValue, minValue, minValueDiff },
        ) {
            if (!step || !sliderWidth || !maxValue) {
                return null;
            }

            const shift = 20;
            const padding = 30;
            const shiftedWidth = sliderWidth - shift;

            if (sliderType === 'linear') {
                if (minValue < 1) {
                    return shiftedWidth / maxValue * step;
                }

                const stepShift = minValue - 1;
                if (step === maxValue) {
                    return shiftedWidth / (maxValue - stepShift) * (step - stepShift) - padding;
                }

                return shiftedWidth / (maxValue - stepShift) * (step - stepShift);
            }

            if (sliderType === 'variable') {
                const pxPerValue = shiftedWidth / maxValue;

                if (step.max === maxValue) {
                    return pxPerValue * step.totalStep - padding;
                }

                return pxPerValue * step.totalStep - pxPerValue * minValueDiff;
            }
        },

        /**
         * Получить значение контролла с учетом цены деления
         * @param {Array} steps
         * @param {number} value
         * @param {number} digitsAfterPoint
         * @return {number}
         */
        getTrueControlValue({ steps, value, digitsAfterPoint }) {
            if (!steps.length) {
                return null;
            }

            let totalValue = 1;

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const index = steps.indexOf(step);

                if (value < step.min || value > step.max) {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                const lastIndex = index - 1;
                const sliderValue = digitsAfterPoint ? parseFloat(value) : parseInt(value, 10);

                if (index > 0) {
                    const lastMaxValue = steps[lastIndex].max;
                    const lastTotalValue = steps[lastIndex].totalValue;

                    totalValue = lastTotalValue + (sliderValue - lastMaxValue) * step.stepValue;
                } else {
                    totalValue = sliderValue;
                }
            }

            totalValue = digitsAfterPoint ? totalValue : Math.round(totalValue);

            return totalValue;
        },

        /**
         * Рассчитать положение ползунка для слайдера
         * @param {Array} steps
         * @param {number} value
         * @return {number}
         */
        // eslint-disable-next-line consistent-return
        getSliderPosition(steps, value) {
            if (!value && value !== 0) {
                return null;
            }

            if (!steps.length) {
                return value;
            }

            for (let i = 0; i < steps.length; i++) {
                const { totalValue, stepValue } = steps[i];
                const prevIndex = i - 1;
                const prevTotalValue = steps[prevIndex] ? steps[prevIndex].totalValue : 0;
                const prevTotalStep = steps[prevIndex] ? steps[prevIndex].totalStep : 0;

                if (value > totalValue) {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                return (value - prevTotalValue) / stepValue + prevTotalStep;
            }
        },

        /**
         * Подписи шагов: формирование подписей в зависимости от
         * типа распределения шагов
         * @param {number} sliderWidth
         * @return {Object}
         */
        getStepsPositions({ width, type, steps, bands }) {
            if (type === 'linear') {
                return this.getMarkingByArray(steps, width);
            }
            if (type === 'variable') {
                return this.getMarkingByObject(bands, width);
            }
            return {};
        },

        /**
         * Отправка значения контролла
         * @param {number} value
         */
        emitValue(value) {
            this.$emit('input', value || null);
        },
    },
};
</script>

<template lang="pug">
.control-input-range
    .control-input-container
        input.input(
            type="text"
            :size="size"
            :disabled="disabled"
            :mask="controlMask"
            :value="inputValue"
            @input="handleInput"
            @blur="handleBlur"
            @focus="handleFocus"
            @mask-input-complete="handleMaskInputComplete"
        )

        .slider
            input.track(
                type="range",
                :min="sliderMin"
                :max="sliderMax"
                :step="sliderStep"
                :value="sliderValue"
                :disabled="disabled"
            )

            input.thumb(
                type="range"
                :min="sliderMin"
                :max="sliderMax"
                :step="sliderStep"
                :value="sliderValue"
                :disabled="disabled"
                @focus="handleFocus"
                @input="handleSliderChange"
            )

        span.unit(v-if="unit")
            | {{unit}}

    .steps(v-if="isStepsVisible")
        span.steps__item(
            v-for="step in stepsPositions",
            :style="{'left': step.position + 'px'}"
        )
            | {{ step.value }}

</template>

<style lang="scss" scoped>
.control-input-range {
    $slider-max-width: 1024;
    $step-shift: 20px;

    position: relative;

    .control-input-container {
        position: relative;
    }

    .input {
        width: 100%;
    }

    .slider {
        display: block;
        height: 4px;
        position: absolute;
        z-index: 1;
        bottom: 1px;
        left: 0px;
        right: 2px;
    }

    .track,
    .thumb {
        width: 100%;
        height: 4px;
        margin: 0;
        position: absolute;
        top: 0;
        left: 1px;
        right: 1px;
        -webkit-appearance: none;
        -moz-appearance: none;
        -ms-appearance: none;
        appearance: none;
        cursor: pointer;

        &:focus {
            outline: none;
        }
    }

    .track {
        border-radius: 0 0 3px 3px;
        overflow: hidden;
        -webkit-appearance: none;
        -moz-appearance: none;
        -ms-appearance: none;
        appearance: none;

        @mixin slider-track {
            background-color: #CDC6F0;
            border: none;
            border-radius: 10px;
            color: transparent;
        }

        @mixin slider-track-distance($width, $border-color) {
            $i: 6;
            $step: 6;
            $content: 0 0 0 2px #{$border-color}#{','};
            @while $i < $width {
                $content: $content + -#{$i}px 0 0 0px #{#5840CC};
                @if $i + $step <= $width {
                    $content: $content#{','};
                }
                $i: $i + $step;
            }
            box-shadow: $content;
        }

        @mixin slider-track-thumb {
            display: block;
            width: 16px;
            height: 20px;
            appearance: none;
            background-image: none;
            @include slider-track-distance($slider-max-width, transparent);
            background-color: transparent;
        }

        &::-webkit-slider-runnable-track {
            @include slider-track;
        }

        &::-webkit-slider-thumb {
            @include slider-track-thumb;
        }

        &::-moz-range-track {
            @include slider-track;
        }

        &::-moz-range-thumb {
            @include slider-track-thumb;
        }

        &::-ms-track {
            @include slider-track;
        }

        &::-ms-fill-lower {
            @include slider-track;
        }

        &::-ms-thumb {
            @include slider-track-thumb;
        }

        &::-ms-fill-lower {
            border-radius: 0;
            background-color: transparent;
        }

        &::-ms-fill-upper {
            border-radius: 0;
            background-color: transparent;
        }
    }

    .thumb {
        background-color: transparent;

        @mixin slider-thumb {
            display: block;
            width: 16px;
            height: 16px;
            position: relative;
            z-index: 4;
            appearance: none;
            border-radius: 30px;
            background-color: #5840CC;
            box-shadow: 0 0 0 2px #FFF;
            transition-property: width, height;
            transition: ease 0.15s;
            cursor: pointer;

            &:hover {
                width: 20px;
                height: 20px;
            }
        }

        &::-webkit-slider-thumb {
            @include slider-thumb;
        }

        &::-moz-range-thumb {
            @include slider-thumb;
        }

        &::-ms-thumb {
            @include slider-thumb;
        }
    }

    .unit {
        display: flex;
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 0;
        bottom: 4px;
        right: 12px;
        z-index: 1;
        font-size: 15px;
        line-height: 18px;
        color: #808080;
    }

    .steps {
        display: block;
        position: relative;
        min-height: 18px;
        margin-top: 6px;
        margin-left: $step-shift;
        left: #{-$step-shift / 2};

        &__item {
            display: block;
            min-width: 30px;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
            font-size: 13px;
            line-height: 18px;
            text-align: center;
            color: #808080;
            transform: translateX(-60%);

            &:first-child {
                text-align: left;
                transform: translateX(#{-$step-shift / 2});
            }
            &:last-child {
                text-align: right;
                transform: translateX(#{$step-shift / 2});
            }
        }
    }
}
</style>
