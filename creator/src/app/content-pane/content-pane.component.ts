import { Component, OnInit, ViewChildren, AfterViewInit } from '@angular/core';
import { UndoRedoService } from '../undo-redo.service';
import { QueryList } from '@angular/core';
import C from '../../../../ts/main/consts';
import { getFontSizeForTier } from '../../../../ts/main/helpers';

@Component({
  selector: 'app-content-pane',
  templateUrl: './content-pane.component.html',
  styleUrls: ['./content-pane.component.css']
})
export class ContentPaneComponent implements OnInit, AfterViewInit {

  containers: ContainerSelector[];

  addingTerm: boolean;
  lastTermAddText = '';
  terms: string[];
  @ViewChildren('termInput') termInputEl: QueryList<any>;

  hDividers = 0;

  selectedRef = '';

  constructor(private undoRedo: UndoRedoService) {
    this.containers = [
      new ContainerSelector('Horizontal'),
      new ContainerSelector('Vertical'),
      new ContainerSelector('Tight Horizontal'),
      new ContainerSelector('Exponent/Subscript')
    ];
    this.updateState = this.updateState.bind(this);
    undoRedo.subscribe(this.updateState);
    this.updateState(undoRedo.getState());
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    // Focus the term input whenever it appears
    this.termInputEl.changes.subscribe({
      next(ql) {
        if (ql.first) {
          ql.first.nativeElement.focus();
        }
      }
    });
  }

  /**
   * Turn the 'add term' button into
   * a text box to add a term.
   */
  addTerm() {
    this.addingTerm = true;
  }

  /**
   * Called when the keyboard is typed when adding a term.
   * @param e The event.
   */
  addTermTyped(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.finishAddingTerm();
      return;
    }
    this.lastTermAddText = (e.target as HTMLInputElement).value;
  }

  /**
   * Typing the term is finished, add it to the state.
   */
  finishAddingTerm() {
    if (!this.addingTerm) {
      // Caused by input being removed activating blur
      return;
    }
    const termText = this.lastTermAddText.trim();
    if (termText === '') {
      throw new Error('blank text not allowed');
    }
    const newState: any = this.undoRedo.getStateClone();
    if (!newState.terms) {
      newState.terms = [];
    }
    newState.terms.push(termText);
    newState.metrics = this.getMetrics(newState);
    this.undoRedo.publishChange(newState);
    this.lastTermAddText = '';
    this.addingTerm = false;
  }

  /**
   * Get a string array for each hDivider. Used by the template.
   */
  getHDividerArray(): string[] {
    const toReturn: string[] = [];
    for (let i = 0; i < this.hDividers; i++) {
      toReturn.push('' + i);
    }
    return toReturn;
  }

  /**
   * Add a new hDivider.
   */
  addHDivider() {
    const newState: any = this.undoRedo.getStateClone();
    if (!newState.hDividers) {
      newState.hDividers = 0;
    }
    newState.hDividers++;
    this.undoRedo.publishChange(newState);
  }

  /**
   * Select a container or some content.
   * @param ref The reference of the content.
   *            Here a 'c' prefix is used for containers, which isn't valid in the context of a canvas controller.
   * @param e The mouse event.
   */
  select(ref: string, e: MouseEvent) {
    this.selectedRef = ref;
    e.stopPropagation();
  }

  /**
   * Deselect whatever is selected.
   */
  deselect() {
    this.selectedRef = '';
  }

  /**
   * Delete the currently selected content.
   * @param e The Mouse event.
   */
  delete(e: MouseEvent) {
    e.stopPropagation();
    const newState: any = this.undoRedo.getStateClone();
    const type = this.selectedRef.charAt(0);
    const index = parseInt(this.selectedRef.substring(1, this.selectedRef.length), 10);
    switch (type) {
      case 't':
        newState.terms.splice(index, 1);
        break;
      case 'h':
        newState.hDividers--;
        break;
      default:
        throw new Error('Undefined content type.');
    }

    // We've just removed the content from the arrays,
    // so now any reference to content later in the
    // array will be incorrect.

    // Recursively look for any numbers in the step hierarchy
    if (newState.steps) {
      newState.steps.forEach(step => {
        recursiveRemove(step.root);
        if (step.color) {
          removeDeletedKeys(step.color);
        }
        if (step.opacity) {
          removeDeletedKeys(step.opacity);
        }
      });
    }

    this.selectedRef = '';
    newState.metrics = this.getMetrics(newState);
    this.undoRedo.publishChange(newState);

    // Looks through the keys of an object to
    // find deleted references.
    function removeDeletedKeys(deleteIn: object) {
      Object.keys(deleteIn).forEach(key => {
        const val = deleteIn[key];
        if (key.charAt(0) === type) {
          // Same content type
          const keyIndex = parseFloat(key.substring(1, key.length));
          if (keyIndex === index) {
            // Reference to deleted content, delete it
            delete deleteIn[key];
          } else if (keyIndex > index) {
            // Deletion affected array, shift this key index down
            const newKey = key.charAt(0) + (keyIndex - 1);
            delete deleteIn[key];
            deleteIn[newKey] = val;
          }
        }
      });
    }

    // Looks through an objects properties to
    // remove a certain index.
    function recursiveRemove(lookIn: object) {
      Object.keys(lookIn).forEach(key => {
        const value = lookIn[key];
        if (typeof value === 'object') {
          recursiveRemove(value);
          if (Array.isArray(value)) {
            /* Treating the array like an object
               leaves empty values. Clear these
               out. */
            lookIn[key] = value.filter(el => el !== null);
          }
        } else if (typeof value === 'string') {
          // If > index, decrement to account for
          // shifting in array, otherwise remove
          if (value.charAt(0) === type) {
            // Value refers to same content type
            const valIndex: number = parseFloat(value.substring(1, value.length));
            if (valIndex === index) {
              delete lookIn[key];
            } else if (valIndex > index) {
              lookIn[key] = value.charAt(0) + (valIndex - 1);
            }
          }
        }
      });
    }

  }

  /**
   * Get the font metrics object for a state.
   * @param state The state to get the metrics for.
   */
  getMetrics(state): object[] {
    const metricsArr = [];
    // Calculate a metrics object for each width tier
    for (let i = 0; i < C.widthTiers.length; i++) {
      const metrics: any = {};
      metricsArr.push(metrics);

      metrics.widths = [];

      /* Look for the max ascent and
         descent, which all terms will use. */
      let maxAscent = 0;
      let maxDescent = 0;
      state.terms.forEach(term => {
        const termMetrics: any = this.measureTerm(term, i);
        if (termMetrics.ascent > maxAscent) {
          maxAscent = termMetrics.ascent;
        }
        if (termMetrics.descent > maxDescent) {
          maxDescent = termMetrics.descent;
        }
        // All terms have their own width
        metrics.widths.push(termMetrics.width);
      });
      metrics.ascent = maxAscent;
      metrics.height = maxAscent + maxDescent;
    }
    return metricsArr;
  }

  /**
   * Measure the metrics for a term.
   * @param term The term to measure.
   * @param tier The width tier to measure this term for.
   */
  private measureTerm(term: string, tier: number): object {
    const toReturn: any = {};

    const fontSize = getFontSizeForTier(tier);

    // Create a canvas to measure with
    const testCanvas = document.createElement('canvas');
    testCanvas.width = C.testCanvasWidth;
    testCanvas.height = fontSize * C.testCanvasFontSizeMultiple;
    const testCtx = testCanvas.getContext('2d');
    testCtx.font = fontSize + 'px ' + C.fontFamily;

    // Get the width
    toReturn.width = testCtx.measureText(term).width;

    // Draw the text on the canvas to measure ascent and descent
    testCtx.fillStyle = 'white';
    testCtx.fillRect(0, 0, testCanvas.width, testCanvas.height);
    testCtx.fillStyle = 'black';
    testCtx.fillText(term, 0, testCanvas.height / 2);

    const image = testCtx.getImageData(0, 0, toReturn.width, testCanvas.height);
    const imageData = image.data;

    // Go down until we find text
    let i = 0;
    while (++i < imageData.length && imageData[i] === 255) {}
    const ascent = i / (image.width * 4);

    // Go up until we find text
    i = imageData.length - 1;
    while (--i > 0 && imageData[i] === 255) {}
    const descent = i / (image.width * 4);

    toReturn.ascent = testCanvas.height / 2 - ascent;
    toReturn.descent = descent - testCanvas.height / 2;

    return toReturn;
  }

  /**
   * Update the view when the state changes.
   * @param newState The new state.
   */
  updateState(newState: any) {
    this.terms = newState.terms ? newState.terms : [];
    this.hDividers = newState.hDividers ? newState.hDividers : 0;
  }
}

class ContainerSelector {
  name: string;
  constructor(name) {
    this.name = name;
  }
}
