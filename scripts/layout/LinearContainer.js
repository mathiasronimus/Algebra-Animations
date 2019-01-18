define(["require", "exports", "./EqContainer", "./EqContent"], function (require, exports, EqContainer_1, EqContent_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * Represents a simple linear container
     * whose contents can be represented as
     * a single children array.
     */
    class LinearContainer extends EqContainer_1.default {
        constructor(children, padding) {
            super(padding);
            this.children = children;
        }
        /**
         * Add a child before another.
         *
         * @param toAdd The child to add.
         * @param before Add before this child.
         */
        addBefore(toAdd, before) {
            let index = this.children.indexOf(before);
            this.children.splice(index, 0, toAdd);
        }
        /**
         * Add a child after another.
         *
         * @param toAdd The child to add.
         * @param after Add after this child.
         */
        addAfter(toAdd, after) {
            let index = this.children.indexOf(after);
            this.children.splice(index + 1, 0, toAdd);
        }
        forEachUnder(forEach) {
            this.children.forEach(child => {
                if (child instanceof EqContent_1.default) {
                    //Run the function
                    forEach(child);
                }
                else if (child instanceof EqContainer_1.default) {
                    child.forEachUnder(forEach);
                }
                else {
                    throw "unrecognized component type";
                }
            });
        }
        delete(toDelete) {
            this.children.splice(this.children.indexOf(toDelete), 1);
        }
        getChildren() {
            return this.children;
        }
    }
    exports.default = LinearContainer;
});
