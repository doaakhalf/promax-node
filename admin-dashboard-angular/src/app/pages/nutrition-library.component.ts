import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type Macros = { calories: number; protein: number; carbs: number; fat: number };

type FoodItem = {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  mealType: string;
  nutritionPer100g: Macros;
  defaultServingGrams: number;
  tags: string[];
  isActive: boolean;
  image?: string | null;
};

type Ingredient = {
  foodId: string;
  quantityGrams: number;
  food?: FoodItem | null;
};

type MealItem = {
  id: string;
  name: string;
  description?: string;
  image?: string | null;
  imageSource?: string | null;
  mealType: string;
  goal: string;
  ingredients: Ingredient[];
  coachNote?: string;
  isActive: boolean;
  totals?: Macros;
};

type Page<T> = {
  data?: T[];
  pagination?: { page: number; totalPages: number; total: number };
};

@Component({
  selector: 'app-nutrition-library',
  imports: [FormsModule],
  template: `
    <h1>Nutrition library</h1>
    <p class="muted">Library foods and meals. Deactivate an item to hide it from coaches.</p>
    @if (error()) { <p class="err">{{ error() }}</p> }
    @if (msg()) { <p class="ok">{{ msg() }}</p> }

    <div class="actions">
      <button class="btn" type="button" [class.ghost]="tab() !== 'foods'" (click)="tab.set('foods')">Foods</button>
      <button class="btn" type="button" [class.ghost]="tab() !== 'meals'" (click)="tab.set('meals')">Meals</button>
    </div>

    @if (tab() === 'foods') {
      <div class="actions">
        <button class="btn" type="button" (click)="openNewFood()">New food</button>
      </div>

      <div class="row">
        <input placeholder="Search foods" [(ngModel)]="foodQuery" name="foodQuery" (keyup.enter)="loadFoods(1)" />
        <select [(ngModel)]="foodMealType" name="foodMealType" (change)="loadFoods(1)">
          <option value="">All meal types</option>
          @for (type of mealTypes; track type) { <option [value]="type">{{ type }}</option> }
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Type</th>
              <th>Per 100g</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (food of foods(); track food.id) {
              <tr>
                <td>
                  @if (food.image && !imageFailed(food.id)) {
                    <img class="food-thumb" [src]="food.image" [alt]="food.nameAr" (error)="markImageFailed(food.id)" />
                  }
                </td>
                <td>
                  <div>{{ food.nameAr }}</div>
                  <div class="muted">{{ food.nameEn }}</div>
                </td>
                <td>{{ food.mealType }}</td>
                <td>{{ food.nutritionPer100g.calories }} kcal · P {{ food.nutritionPer100g.protein }}</td>
                <td>{{ food.isActive ? 'Active' : 'Hidden' }}</td>
                <td class="actions">
                  <button class="btn sm ghost" type="button" (click)="editFood(food)">Edit</button>
                  <button class="btn sm" type="button" (click)="toggleFood(food)">
                    {{ food.isActive ? 'Deactivate' : 'Activate' }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="foodPage() <= 1" (click)="loadFoods(foodPage() - 1)">Previous</button>
        <span class="muted">Page {{ foodPage() }} / {{ foodPages() }} · {{ foodTotal() }} foods</span>
        <button class="btn sm ghost" type="button" [disabled]="foodPage() >= foodPages()" (click)="loadFoods(foodPage() + 1)">Next</button>
      </div>
    } @else {
      <div class="actions">
        <button class="btn" type="button" (click)="openNewMeal()">New meal</button>
      </div>

      <div class="grid">
        @for (meal of meals(); track meal.id) {
          <article class="card pad">
            @if (meal.image && !imageFailed(meal.id)) {
              <img class="meal-img" [src]="meal.image" [alt]="meal.name" (error)="markImageFailed(meal.id)" />
            } @else if (meal.image) {
              <p class="muted">Image link did not load.</p>
            }
            <h2>{{ meal.name }}</h2>
            <p class="muted">{{ meal.mealType }} · {{ meal.goal }} · {{ meal.isActive ? 'Active' : 'Hidden' }}</p>
            <p>{{ meal.description }}</p>
            @if (meal.totals) {
              <p class="muted">{{ meal.totals.calories }} kcal · P {{ meal.totals.protein }} · C {{ meal.totals.carbs }} · F {{ meal.totals.fat }}</p>
            }
            <ul>
              @for (item of meal.ingredients; track item.foodId) {
                <li>{{ item.food?.nameAr || item.foodId }} · {{ item.quantityGrams }} g</li>
              }
            </ul>
            <div class="actions">
              <button class="btn sm ghost" type="button" (click)="editMeal(meal)">Edit</button>
              <button class="btn sm" type="button" (click)="toggleMeal(meal)">
                {{ meal.isActive ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </article>
        }
      </div>
      <div class="actions">
        <button class="btn sm ghost" type="button" [disabled]="mealPage() <= 1" (click)="loadMeals(mealPage() - 1)">Previous</button>
        <span class="muted">Page {{ mealPage() }} / {{ mealPages() }} · {{ mealTotal() }} meals</span>
        <button class="btn sm ghost" type="button" [disabled]="mealPage() >= mealPages()" (click)="loadMeals(mealPage() + 1)">Next</button>
      </div>
    }

    @if (editor() === 'food') {
      <div class="backdrop" (click)="closeEditor()">
        <form class="card dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()" (ngSubmit)="saveFood()">
          <div class="dialog-head">
            <h2>{{ foodForm.id ? 'Edit food' : 'New food' }}</h2>
            <button class="btn ghost sm" type="button" (click)="closeEditor()">Close</button>
          </div>
          <label>Arabic name</label>
          <input name="nameAr" [(ngModel)]="foodForm.nameAr" required />
          <label>English name</label>
          <input name="nameEn" [(ngModel)]="foodForm.nameEn" />
          <label>Meal type</label>
          <select name="mealType" [(ngModel)]="foodForm.mealType">
            @for (type of mealTypes; track type) { <option [value]="type">{{ type }}</option> }
          </select>
          <label>Calories / 100g</label>
          <input name="calories" type="number" min="0" step="0.1" [(ngModel)]="foodForm.calories" />
          <label>Protein / 100g</label>
          <input name="protein" type="number" min="0" step="0.1" [(ngModel)]="foodForm.protein" />
          <label>Carbs / 100g</label>
          <input name="carbs" type="number" min="0" step="0.1" [(ngModel)]="foodForm.carbs" />
          <label>Fat / 100g</label>
          <input name="fat" type="number" min="0" step="0.1" [(ngModel)]="foodForm.fat" />
          <label>Default grams</label>
          <input name="grams" type="number" min="1" step="1" [(ngModel)]="foodForm.defaultServingGrams" />
          <label>Image link</label>
          <input name="foodImage" [(ngModel)]="foodForm.image" placeholder="https://..." (ngModelChange)="formImageFailed.set(false)" />
          @if (foodForm.image.trim()) {
            <a class="image-link" [href]="foodForm.image.trim()" target="_blank" rel="noopener noreferrer">Open image link</a>
            @if (!formImageFailed()) {
              <img class="meal-img preview" [src]="foodForm.image.trim()" alt="" (error)="formImageFailed.set(true)" />
            } @else {
              <p class="muted">Image link did not load. Save a different link.</p>
            }
          }
          <label>Tags</label>
          <input name="tags" [(ngModel)]="foodForm.tags" placeholder="high_protein, vegetarian" />
          <label class="chk"><input type="checkbox" name="foodActive" [(ngModel)]="foodForm.isActive" /> Active</label>
          <div class="dialog-actions">
            <button class="btn ghost" type="button" (click)="closeEditor()">Cancel</button>
            <button class="btn" type="submit">{{ foodForm.id ? 'Save food' : 'Add food' }}</button>
          </div>
        </form>
      </div>
    }

    @if (editor() === 'meal') {
      <div class="backdrop" (click)="closeEditor()">
        <form class="card dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()" (ngSubmit)="saveMeal()">
          <div class="dialog-head">
            <h2>{{ mealForm.id ? 'Edit meal' : 'New meal' }}</h2>
            <button class="btn ghost sm" type="button" (click)="closeEditor()">Close</button>
          </div>
          <label>Name</label>
          <input name="mealName" [(ngModel)]="mealForm.name" required />
          <label>Description</label>
          <textarea name="description" rows="2" [(ngModel)]="mealForm.description"></textarea>
          <label>Meal type</label>
          <select name="mealMealType" [(ngModel)]="mealForm.mealType">
            @for (type of mealTypes; track type) { <option [value]="type">{{ type }}</option> }
          </select>
          <label>Goal</label>
          <select name="goal" [(ngModel)]="mealForm.goal">
            @for (goal of goals; track goal) { <option [value]="goal">{{ goal }}</option> }
          </select>
          <label>Image link</label>
          <input name="image" [(ngModel)]="mealForm.image" placeholder="https://..." (ngModelChange)="formImageFailed.set(false)" />
          @if (mealForm.image.trim()) {
            <a class="image-link" [href]="mealForm.image.trim()" target="_blank" rel="noopener noreferrer">Open image link</a>
            @if (!formImageFailed()) {
              <img class="meal-img preview" [src]="mealForm.image.trim()" alt="" (error)="formImageFailed.set(true)" />
            } @else {
              <p class="muted">Image link did not load. Save a different link.</p>
            }
          }
          <label>Image source</label>
          <input name="imageSource" [(ngModel)]="mealForm.imageSource" />
          <label>Coach note</label>
          <input name="coachNote" [(ngModel)]="mealForm.coachNote" />
          <label class="chk"><input type="checkbox" name="mealActive" [(ngModel)]="mealForm.isActive" /> Active</label>
          <h3>Ingredients</h3>
          @for (row of mealForm.ingredients; track $index) {
            <div class="ingredient">
              <select [(ngModel)]="row.foodId" [name]="'food' + $index">
                <option value="">Select food</option>
                @for (food of foodOptions(); track food.id) {
                  <option [value]="food.id">{{ food.nameAr }}</option>
                }
              </select>
              <input type="number" min="1" step="1" [(ngModel)]="row.quantityGrams" [name]="'grams' + $index" />
              <button class="btn sm ghost" type="button" (click)="removeIngredient($index)">Remove</button>
            </div>
          }
          <button class="btn sm ghost" type="button" (click)="addIngredient()">Add ingredient</button>
          <div class="dialog-actions">
            <button class="btn ghost" type="button" (click)="closeEditor()">Cancel</button>
            <button class="btn" type="submit">{{ mealForm.id ? 'Save meal' : 'Add meal' }}</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    h2 { font-size: 1.05rem; margin: 0 0 0.75rem; }
    h3 { font-size: 0.95rem; }
    .ingredient { display: grid; grid-template-columns: 1fr 120px auto; gap: 0.5rem; align-items: start; }
    .ingredient input, .ingredient select { margin-top: 0; }
    .food-thumb { width: 112px; height: 112px; object-fit: cover; border-radius: 10px; background: #11181f; display: block; }
    .meal-img { width: 100%; height: 160px; object-fit: cover; border-radius: 8px; margin: 0.35rem 0 0.75rem; background: #11181f; }
    .meal-img.preview { height: 180px; }
    .image-link { display: inline-block; margin: -0.35rem 0 0.75rem; color: var(--accent); font-size: 0.85rem; word-break: break-all; }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.55);
    }
    .dialog {
      width: min(640px, 100%);
      max-height: min(88vh, 860px);
      overflow: auto;
      padding: 1.1rem 1.2rem 1.25rem;
    }
    .dialog-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .dialog-head h2 { margin: 0; }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .chk { display: flex; align-items: center; gap: 0.4rem; margin: 0.4rem 0 0.8rem; }
    .chk input { width: auto; margin: 0; }
    @media (max-width: 800px) {
      .ingredient { grid-template-columns: minmax(0, 1fr); }
    }
  `,
})
export class NutritionLibraryComponent implements OnInit {
  private api = inject(ApiService);

  mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  goals = ['cutting', 'bulking', 'maintenance'];

  tab = signal<'foods' | 'meals'>('foods');
  editor = signal<'food' | 'meal' | null>(null);
  error = signal('');
  msg = signal('');
  foods = signal<FoodItem[]>([]);
  foodOptions = signal<FoodItem[]>([]);
  meals = signal<MealItem[]>([]);
  foodPage = signal(1);
  foodPages = signal(1);
  foodTotal = signal(0);
  mealPage = signal(1);
  mealPages = signal(1);
  mealTotal = signal(0);
  foodQuery = '';
  foodMealType = '';
  formImageFailed = signal(false);
  private failedImageIds = signal<ReadonlySet<string>>(new Set());

  foodForm = this.emptyFood();
  mealForm = this.emptyMeal();

  ngOnInit() {
    this.loadFoods(1);
    this.loadFoodOptions();
    this.loadMeals(1);
  }

  loadFoods(page: number) {
    const params = new URLSearchParams({ page: String(page), limit: '20', source: 'library' });
    if (this.foodQuery.trim()) params.set('q', this.foodQuery.trim());
    if (this.foodMealType) params.set('mealType', this.foodMealType);
    this.api.get<Page<FoodItem>>(`/api/admin/food-items?${params}`).subscribe({
      next: (res) => {
        this.foods.set(res.data || []);
        this.foodPage.set(res.pagination?.page || page);
        this.foodPages.set(res.pagination?.totalPages || 1);
        this.foodTotal.set(res.pagination?.total || 0);
        this.error.set('');
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  loadFoodOptions() {
    this.api.get<Page<FoodItem>>('/api/admin/food-items?limit=200&source=library').subscribe({
      next: (res) => this.foodOptions.set(res.data || []),
      error: (err: Error) => this.error.set(err.message),
    });
  }

  loadMeals(page: number) {
    this.api.get<Page<MealItem>>(`/api/admin/meal-templates?page=${page}&limit=20&source=library`).subscribe({
      next: (res) => {
        this.meals.set(res.data || []);
        this.mealPage.set(res.pagination?.page || page);
        this.mealPages.set(res.pagination?.totalPages || 1);
        this.mealTotal.set(res.pagination?.total || 0);
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  saveFood() {
    const body = {
      nameAr: this.foodForm.nameAr.trim(),
      nameEn: this.foodForm.nameEn.trim() || null,
      mealType: this.foodForm.mealType,
      nutritionPer100g: {
        calories: Number(this.foodForm.calories),
        protein: Number(this.foodForm.protein),
        carbs: Number(this.foodForm.carbs),
        fat: Number(this.foodForm.fat),
      },
      defaultServingGrams: Number(this.foodForm.defaultServingGrams),
      image: this.foodForm.image.trim() || null,
      tags: this.foodForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      isActive: this.foodForm.isActive,
    };
    const request = this.foodForm.id
      ? this.api.put(`/api/admin/food-items/${this.foodForm.id}`, body)
      : this.api.post('/api/admin/food-items', body);
    request.subscribe({
      next: () => {
        const id = this.foodForm.id;
        this.msg.set(id ? 'Food updated' : 'Food added');
        if (id) {
          this.failedImageIds.update((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }
        this.closeEditor();
        this.loadFoods(this.foodPage());
        this.loadFoodOptions();
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  editFood(food: FoodItem) {
    this.foodForm = {
      id: food.id,
      nameAr: food.nameAr,
      nameEn: food.nameEn || '',
      mealType: food.mealType,
      calories: food.nutritionPer100g.calories,
      protein: food.nutritionPer100g.protein,
      carbs: food.nutritionPer100g.carbs,
      fat: food.nutritionPer100g.fat,
      defaultServingGrams: food.defaultServingGrams,
      image: food.image || '',
      tags: (food.tags || []).join(', '),
      isActive: food.isActive,
    };
    this.formImageFailed.set(false);
    this.editor.set('food');
  }

  openNewFood() {
    this.foodForm = this.emptyFood();
    this.formImageFailed.set(false);
    this.editor.set('food');
  }

  toggleFood(food: FoodItem) {
    this.api.put(`/api/admin/food-items/${food.id}`, { isActive: !food.isActive }).subscribe({
      next: () => {
        this.msg.set(food.isActive ? 'Food hidden from coaches' : 'Food activated');
        this.loadFoods(this.foodPage());
        this.loadFoodOptions();
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  saveMeal() {
    const ingredients = this.mealForm.ingredients
      .filter((row) => row.foodId)
      .map((row) => ({ foodId: row.foodId, quantityGrams: Number(row.quantityGrams) }));
    const body = {
      name: this.mealForm.name.trim(),
      description: this.mealForm.description.trim(),
      mealType: this.mealForm.mealType,
      goal: this.mealForm.goal,
      image: this.mealForm.image.trim() || null,
      imageSource: this.mealForm.imageSource.trim() || null,
      coachNote: this.mealForm.coachNote.trim(),
      isActive: this.mealForm.isActive,
      ingredients,
    };
    const request = this.mealForm.id
      ? this.api.put(`/api/admin/meal-templates/${this.mealForm.id}`, body)
      : this.api.post('/api/admin/meal-templates', body);
    request.subscribe({
      next: () => {
        const id = this.mealForm.id;
        this.msg.set(id ? 'Meal updated' : 'Meal added');
        if (id) {
          this.failedImageIds.update((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }
        this.closeEditor();
        this.loadMeals(this.mealPage());
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  editMeal(meal: MealItem) {
    this.mealForm = {
      id: meal.id,
      name: meal.name,
      description: meal.description || '',
      mealType: meal.mealType,
      goal: meal.goal,
      image: meal.image || '',
      imageSource: meal.imageSource || '',
      coachNote: meal.coachNote || '',
      isActive: meal.isActive,
      ingredients: meal.ingredients.map((row) => ({
        foodId: row.foodId,
        quantityGrams: row.quantityGrams,
      })),
    };
    this.formImageFailed.set(false);
    this.editor.set('meal');
  }

  openNewMeal() {
    this.mealForm = this.emptyMeal();
    this.formImageFailed.set(false);
    this.editor.set('meal');
  }

  closeEditor() {
    this.editor.set(null);
  }

  imageFailed(id: string) {
    return this.failedImageIds().has(id);
  }

  markImageFailed(id: string) {
    this.failedImageIds.update((current) => new Set(current).add(id));
  }

  toggleMeal(meal: MealItem) {
    this.api.put(`/api/admin/meal-templates/${meal.id}`, { isActive: !meal.isActive }).subscribe({
      next: () => {
        this.msg.set(meal.isActive ? 'Meal hidden from coaches' : 'Meal activated');
        this.loadMeals(this.mealPage());
      },
      error: (err: Error) => this.error.set(err.message),
    });
  }

  addIngredient() {
    this.mealForm.ingredients = [...this.mealForm.ingredients, { foodId: '', quantityGrams: 100 }];
  }

  removeIngredient(index: number) {
    this.mealForm.ingredients = this.mealForm.ingredients.filter((_, i) => i !== index);
  }

  private emptyFood() {
    return {
      id: '',
      nameAr: '',
      nameEn: '',
      mealType: 'lunch',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      defaultServingGrams: 100,
      image: '',
      tags: '',
      isActive: true,
    };
  }

  private emptyMeal() {
    return {
      id: '',
      name: '',
      description: '',
      mealType: 'breakfast',
      goal: 'maintenance',
      image: '',
      imageSource: '',
      coachNote: '',
      isActive: true,
      ingredients: [{ foodId: '', quantityGrams: 100 }],
    };
  }
}
