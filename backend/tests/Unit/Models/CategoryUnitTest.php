<?php

namespace Tests\Unit\Models;

use App\Models\Category;
use App\Traits\UuidTrait;
use EloquentFilter\Filterable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Tests\TestCase;

class CategoryUnitTest extends TestCase
{
    
    public function testFillableAttribute()
    {
        $category = new Category();
        $fillable = ['name', 'description', 'is_active'];
        $this->assertEquals($fillable, $category->getFillable());
    }

    public function testCastAttribute()
    {
        $category = new Category();
        $cast = ['id' => 'string', 'is_active' => 'boolean'];
        $this->assertEquals($cast, $category->getCasts());
    }

    public function testIncrementing()
    {
        $category = new Category();
        $this->assertFalse($category->incrementing);
    }

    public function testIfUseTraits()
    {
        $trais = [SoftDeletes::class, UuidTrait::class, Filterable::class];
        $categoryTraits = array_keys(class_uses(Category::class));
        $this->assertEquals($trais, $categoryTraits);
    }

    public function testDatesAttribute()
    {
        $dates = ['deleted_at', 'created_at', 'updated_at'];
        $category = new Category();
        $categoryDates = $category->getDates();

        foreach ($dates as $date) {
            $this->assertContains($date, $categoryDates);
        }

        $this->assertCount(count($dates), $categoryDates);
    }
}
