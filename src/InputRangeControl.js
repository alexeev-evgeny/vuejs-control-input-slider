import './styles/inputRangeControl.scss';

export default {
    template: require('./templates/inputRangeControl.pug'),
    props: {
        value: {
            type: Number,
            default: null
        },
        type: {
            type: String,
            default: 'linear',
            validate (val) {
                return val === 'linear' || val === 'variable';
            }
        },
        steps: {
            type: [Array, Object],
            default () {
                return [1, 50, 90];

                /**
                 *  Steps object example for 'variable' type
                 *
                    return [
                        {
                            min: 1,
                            max: 10,
                            step: 1,
                        },
                        {
                            min: 11,
                            max: 50,
                            step: 5,
                        },
                        {
                            min: 51,
                            max: 150,
                            step: 10,
                        },
                        {
                            min: 151,
                            max: 500,
                            step: 25,
                        }
                    ];
                 *
                 */
            }
        },
        unit: {
            type: String,
            default: ''
        },
    },

    data () {
        this._valueTimeout = null;
        this._lastControlValue = null;
        return {
            control: {
                value: 1,
                trueValue: 1,
                step: this.step,
                min: 1,
                max: null,
            },
            min: 1,
            max: null,
            sliderBands: [],
            stepsPositions: {}
        };
    },

    created () {
        this._init();
    },

    mounted () {
        this.stepsPositions = this._getStepsPositions(this.$el.clientWidth);
        this.$onBreakpoint([], () => {
            this.stepsPositions = this._getStepsPositions(this.$el.clientWidth);
        });
    },

    methods: {
        /**
         * Инициализация начальных значений
         *
         */
        _init: function () {
            if (!this.steps.length) {
                return;
            }

            if (this.type === 'linear') {
                this.min = this.steps[0];
                this.max = this.steps[this.steps.length - 1];
                this.control.min = this.min;
                this.control.trueValue = this.value ? this.value : this.min;
                this.control.value = this.value ? this.value : this.min;
            }

            if (this.type === 'variable') {
                const maxStepIndex = this.steps.length - 1;
                this.min = this.steps[0].min;
                this.max = this.steps[maxStepIndex].max;
                this.sliderBands = this._getBandsMap(this.steps);
                this.control.trueValue = this.value ? this.value : this.min;
                this.control.value = this._getSliderPosition(
                    this.sliderBands,
                    this.value
                );
            }
        },

        /**
         * Input: обработка ввода
         *
         * @param {Object} event
         */
        onInputChange: function (event) {
            clearTimeout(this._valueTimeout);

            const notValidKeys = [
                16, 69, 106, 107, 109, 110, 111, 187, 188, 189, 190, 191
            ];
            const prevValue = event.target.value;
            const isNullKeyNotValid = (prevValue == '' && event.keyCode == 48);

            if (notValidKeys.indexOf(event.keyCode) > -1 || isNullKeyNotValid) {
                event.preventDefault();
                return;
            }

            this._valueTimeout = setTimeout(() => {
                const stepsMax = (this.max || this.steps[this.steps.length - 1]);
                const stepsMin = (this.min || this.steps[0]);

                this._handleInputValue(this.control.trueValue, stepsMin, stepsMax);
            }, 300);


        },

        /**
         * Input: обработка потери фокуса
         */
        onInputBlur: function () {
            if (this.control.trueValue && this.control.trueValue > this.min) {
                return;
            }

            const stepsMin = (this.min || this.steps[0]);

            this.control.trueValue = stepsMin;
            this.control.value = stepsMin;

            this._emitValue(stepsMin);
        },

        /**
         * Range-slider: обработка изменения значения
         */
        onSliderChange: function () {
            if (this.control.value === this._lastControlValue) {
                return;
            }

            const newValue = this.control.value;
            let newTrueValue = null;

            if (this.sliderBands.length) {
                newTrueValue = this._getTrueValue(this.sliderBands, newValue);
            } else {
                newTrueValue = newValue;
            }

            this.control.trueValue = newTrueValue;
            this._lastControlValue = newValue;
            this._emitValue(newTrueValue);
        },


        /**
         * Input: обработчик значения
         *
         * @param {Number} newValue
         * @param {Number} stepsMin
         * @param {Number} stepsMax
         */
        _handleInputValue: function (newValue, stepsMin, stepsMax) {
            let newSliderValue = null;

            switch (true) {
                case newValue > stepsMax:
                    newSliderValue = this._getSliderPosition(
                        this.sliderBands,
                        stepsMax
                    );
                    this.control.trueValue = stepsMax;
                    this.control.value = newSliderValue;
                    this._emitValue(stepsMax);
                    break;
                case newValue < 0:
                    this.control.trueValue = stepsMin;
                    this._emitValue(stepsMin);
                    break;
                default:
                    newSliderValue = this._getSliderPosition(
                        this.sliderBands,
                        newValue
                    );
                    this.control.value = newSliderValue;
                    this._emitValue(newSliderValue);
                    break;
            }
        },

        /**
         * Диапазоны: рассчет необходимых дополнительных данных
         *
         * @param {Array} bands
         * @return {Array}
         */
        _getBandsMap: function (bands) {
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
                const stepsCount = (band.max - band.min + 1) / band.step;

                if (index > 0) {
                    bandMin = bandMax;
                }

                bandMax = bandMax + stepsCount;
                totalStep = totalStep + stepsCount;
                totalValue = band.max;

                bandsMap.push({
                    min: bandMin,
                    max: bandMax,
                    count: stepsCount,
                    stepValue: band.step,
                    totalValue: totalValue,
                    totalStep: totalStep,
                });
            }

            return bandsMap;
        },

        /**
         * Подписи шагов при линейном распределении
         *
         * @param {Array} steps
         * @param {Number} sliderWidth
         * @return {Object}
         */
        _getMarkingByArray: function (steps, sliderWidth) {
            if (!Array.isArray(steps) || !sliderWidth) {
                return {};
            }

            const stepsMap = {};
            const minValue = steps[0];
            const maxValue = steps[steps.length - 1];

            this.control.max = maxValue;
            stepsMap[minValue] = 0;

            for (let i = 1; i < steps.length; i++) {
                const stepPosition = (
                    this._getStepPosition(
                        this.type, steps[i], sliderWidth, {maxValue, minValue}
                    )
                );
                const currentStep = steps[i];
                stepsMap[currentStep] = stepPosition;
            }

            return stepsMap;
        },

        /**
         * Подписи шагов при нелинейном распределении
         *
         * @param {Array} steps
         * @param {Number} sliderWidth
         * @return {Object}
         */
        _getMarkingByObject: function (steps, sliderWidth) {
            if (!Array.isArray(steps) || !sliderWidth) {
                return {};
            }

            this.control.min = this.min;
            this.control.max = this.max;

            const maxStepIndex = steps.length - 1;
            const minValue = steps[0].min;
            const maxValue = steps[maxStepIndex].totalStep;
            const minValueDiff = minValue - 1;

            this.control.max = maxValue;

            const stepsArray = [];
            let stepsMap = {};
            stepsMap[steps[0].min] = 0;

            for (let i = 0; i < steps.length; i++) {
                stepsArray.push(steps[i].totalValue);
            }

            for (let i = 0; i < stepsArray.length; i++) {
                const stepPosition = (
                    this._getStepPosition(
                        this.type, steps[i], sliderWidth, {maxValue}, minValueDiff
                    )
                );
                const currentStep = stepsArray[i];
                stepsMap[currentStep] = stepPosition;
            }

            return stepsMap;
        },

        /**
         * Получить координату позиции шага в пикселях
         *
         * @param {String} sliderType
         * @param {Object} step
         * @param {Number} sliderWidth
         * @param {Object} maxValue, minValue
         * @param {Number} minValueDiff
         * @return {Number}
         */
        _getStepPosition: function (
            sliderType = 'linear', step, sliderWidth, {maxValue, minValue}, minValueDiff
        ) {
            if (!step || !sliderWidth || !maxValue) {
                return null;
            }

            const shift = 20;
            const padding = 30;
            sliderWidth = sliderWidth - shift;

            if (sliderType === 'linear') {
                if (minValue < 1) {
                    return (sliderWidth / maxValue * step);
                }

                const stepShift = minValue - 1;
                if (step == maxValue) {
                    return (
                        (sliderWidth / (maxValue - stepShift) * (step - stepShift)) - padding
                    );
                }

                return (
                    sliderWidth / (maxValue - stepShift) * (step - stepShift)
                );
            }

            if (sliderType === 'variable') {
                const pxPerValue = (sliderWidth / maxValue);

                if (step.max === maxValue) {
                    return (pxPerValue * step.totalStep) - padding;
                }

                return (pxPerValue * step.totalStep) - (pxPerValue * minValueDiff);
            }
        },

        /**
         * Получить истинное значение контролла
         *
         * @param {Array} steps
         * @param {Number} value
         * @return {Number}
         */
        _getTrueValue: function (steps, value) {
            if (!steps.length) {
                return null;
            }

            let totalValue = 1;

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const index = steps.indexOf(step);

                if (value < step.min ||
                    value > step.max) {
                    continue;
                }

                const lastIndex = index - 1;
                const controlValue = Number(value);

                if (index > 0) {
                    const lastMaxValue = steps[lastIndex].max;
                    const lastTotalValue = steps[lastIndex].totalValue;

                    totalValue = lastTotalValue + (
                        (controlValue - lastMaxValue) * step.stepValue
                    );
                } else {
                    totalValue = controlValue;
                }
            }

            totalValue = Math.round(totalValue);

            return totalValue;
        },

        /**
         * Рассчитать положение ползунка для слайдера
         *
         * @param {Array} steps
         * @param {Number} value
         * @return {Number}
         */
        _getSliderPosition: function (steps, value) {
            if (!value && value !== 0) {
                return null;
            }

            if (!steps.length) {
                return value;
            }

            for (let i = 0; i < steps.length; i++) {
                const totalValue = steps[i].totalValue;
                const prevIndex = i - 1;
                const prevTotalValue = (
                        steps[prevIndex] ? steps[prevIndex].totalValue : 0
                    );
                const prevTotalStep = (
                        steps[prevIndex] ? steps[prevIndex].totalStep : 0
                    );

                if (value > totalValue) {
                    continue;
                }

                return (
                    ((value - prevTotalValue) / steps[i].stepValue) +
                    prevTotalStep
                );
            }
        },

        /**
         * Подписи шагов: формирование подписей в зависимости от
         * типа распределения шагов
         *
         * @param {Number} sliderWidth
         * @return {Object}
         */
        _getStepsPositions: function (sliderWidth) {
            switch (this.type) {
                case 'linear':
                    return this._getMarkingByArray(this.steps, sliderWidth);
                case 'variable':
                    return this._getMarkingByObject(this.sliderBands, sliderWidth);
                default:
                    return {};
            }
        },

        /**
         * Отправка значения контролла
         *
         * @param {Number} value
         */
        _emitValue: function (value) {
            if (!value) {
                this.$emit('inputRangeControlChanged', null);
            }
            this.$emit('inputRangeControlChanged', value);
        }
    },
};
