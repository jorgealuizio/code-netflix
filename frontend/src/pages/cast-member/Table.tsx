import * as React from 'react'
import parseISO from 'date-fns/parseISO'
import format from 'date-fns/format'
import castMemberHttp from '../../util/http/cast-member-http'
import { CastMember, ListResponse, CastMemberTypeMap } from '../../util/models'
import DefaultTable, { TableColumn, MuiDataTableRefComponent } from '../../components/Table'
import { useSnackbar } from 'notistack'
import useFilter from '../../hooks/useFilter'
import { FilterResetButton } from '../../components/Table/FilterResetButton'
import { IconButton } from '@material-ui/core'
import EditIcon from '@material-ui/icons/Edit'
import { Link } from 'react-router-dom'
import * as yup from '../../util/vendor/yup'
import {invert} from 'lodash'
import useDeleteCollection from '../../hooks/useDeleteCollection'
import DeleteDialog from '../../components/DeleteDialog'
import LoadingContext from '../../components/loading/LoadigContext'

const castMemberNames = Object.values(CastMemberTypeMap)


const columnsDefinition: TableColumn[] = [
    {
        name: "id",
        label: "ID",
        width: '30%',
        options: {
            sort: false,
            filter: false
        }
    },
    {
        name: 'name',
        label: 'Nome',
        width: '43%',
        options: {
            filter: false
        }
    },
    {
        name: 'type',
        label: 'Tipo',
        width: '5%',
        options: {
            filterOptions: {
                names: castMemberNames
            },
            customBodyRender(value, tableMeta, updateValue) {   
            return CastMemberTypeMap[value] !== undefined ? <span>{CastMemberTypeMap[value]}</span> : '-'
            }
        }
    },
    {
        name: 'created_at',
        label: 'Criado em',
        width: '10%',
        options: {
            filter: false,
            customBodyRender(value, tableMeta, updateValue) {
            return <span>{format(parseISO(value), 'dd/MM/yyyy')}</span>
            }
        }
    },
    {
        name: 'actions',
        label: 'Ações',
        width: '12%',
        options: {
            sort: false,
            filter: false,
            customBodyRender: (value, tableMeta) => {
                return (
                    <IconButton
                        color={'secondary'}
                        component={Link}
                        to={`/cast-members/${tableMeta.rowData[0]}/edit`}
                    >
                        <EditIcon/>
                    </IconButton>
                )
            }
        }
    }
]

const debounceTime = 300
const debouncedSearchTime = 300
const rowsPerPage = 15
const rowsPerPageOptions =  [10, 25, 50]

const Table = () => {

    const {enqueueSnackbar} = useSnackbar()
    const subscribed = React.useRef(true)
    const [data, setData] = React.useState<CastMember[]>([])
    const loading = React.useContext(LoadingContext)
    const {openDeleteDialog, setOpenDeleteDialog, rowsToDelete, setRowsToDelete} = useDeleteCollection()
    const tableRef = React.useRef() as React.MutableRefObject<MuiDataTableRefComponent>
    const extraFilter = React.useMemo(() => ({
        createValidationSchema: () => {
            return yup.object().shape({
                type: yup.string()
                    .nullable()
                    .transform(value => !value || castMemberNames.includes(value) ? undefined : value)
                    .default(null)
            })
        },
        formatSearchParams: (debouncedFilterState) => {
            return debouncedFilterState.extraFilter ? {
                ...(
                    debouncedFilterState.extraFilter.type && {
                        type: debouncedFilterState.extraFilter.type
                    }
                ) 
            } : undefined
        },
        getStateFromUrl: (queryParams) => {
            return {
                type: queryParams.get('type')
            }
        }
    }), [])

    const {
        columns,
        cleanSearchText,
        filterManager,
        filterState,
        debouncedFilterState,
        totalRecords,
        setTotalRecords} = useFilter({
            columns: columnsDefinition,
            debounceTime: debounceTime,
            rowsPerPage,
            rowsPerPageOptions,
            tableRef,
            extraFilter
        })

    const searchText = cleanSearchText(debouncedFilterState.search)
    const indexColumnType = columns.findIndex(c => c.name === 'type')
    const columnType = columns[indexColumnType]
    const typeFilterValue = filterState.extraFilter && filterState.extraFilter.type as never
    (columnType.options as any).filterList = typeFilterValue ? [typeFilterValue] : []
    
    const serverSideFilterList = columns.map(c => [])
    if (typeFilterValue) {
        serverSideFilterList[indexColumnType] = [typeFilterValue]
    }

    const getData = React.useCallback(async ({search, page ,per_page, sort, dir, type}) => {
        try {
            const {data} = await castMemberHttp.list<ListResponse<CastMember>>({
                queryParams: {
                    search,
                    page,
                    per_page,
                    sort,
                    dir,
                    ...(
                        type &&
                        {
                            type: invert(CastMemberTypeMap)[
                                type
                            ],
                        }
                    )
                }
            })
            if (subscribed.current) {
                setData(data.data)
                setTotalRecords(data.meta.total)
                if (openDeleteDialog) {
                    setOpenDeleteDialog(false)
                }
            }
        } catch (error) {
            console.error(error)
            if (castMemberHttp.isCancelledRequest(error)) {
                enqueueSnackbar('Não foi possível carregar as informações.', {
                    variant: 'error'
                })
            }
        }
    }, [openDeleteDialog, enqueueSnackbar])

    React.useEffect(() => {
        subscribed.current = true
        getData({
            search: searchText,
            page: debouncedFilterState.pagination.page,
            per_page: debouncedFilterState.pagination.per_page,
            sort: debouncedFilterState.order.sort,
            dir: debouncedFilterState.order.dir,
            ...(
                debouncedFilterState.extraFilter &&
                debouncedFilterState.extraFilter.type && {
                    type: debouncedFilterState.extraFilter.type
                }
            )
        })
        return () => {
            subscribed.current = false
        }
    }, [
        getData,
        searchText,
        debouncedFilterState.pagination.page,
        debouncedFilterState.pagination.per_page,
        debouncedFilterState.order,
        debouncedFilterState.extraFilter
    ])


    function deleteRows(confirmed: boolean) {
        if (!confirmed) {
            setOpenDeleteDialog(false)
            return
        }

        const ids = rowsToDelete
            .data
            .map(value => data[value.index].id)
            .join(',')
        
        castMemberHttp
            .deleteCollection({ids})
            .then(response => {
                enqueueSnackbar('Registros excluidos com sucesso!', {
                    variant: 'success'
                })
                if (rowsToDelete.data.length === filterState.pagination.per_page && filterState.pagination.page > 1) {
                    const page = filterState.pagination.page - 2
                    filterManager.changePage(page)
                } else {
                    //getData()
                }
            })
            .catch(error => {
                console.error(error)
                enqueueSnackbar('Não foi possível excluir os registros', {
                    variant: 'error'
                })
            })
    }

    return (
        <>
            <DeleteDialog open={openDeleteDialog} handleClose={deleteRows}/>
            <DefaultTable 
                columns={columns}
                title=""
                data={data}
                loading={loading}
                debouncedSearchTime={debouncedSearchTime}
                ref={tableRef}
                options={{
                    serverSide: true,
                    serverSideFilterList,
                    searchText: filterState.search as any,
                    page: filterState.pagination.page - 1,
                    rowsPerPage: filterState.pagination.per_page,
                    count: totalRecords,
                    onFilterChange: (column, filterList) => {
                        const columnIndex = columns.findIndex(c => c.name === column)
                        filterManager.changeExtraFilter({
                            [column]: filterList[columnIndex].length ? filterList[columnIndex][0] : null
                        })
                    },
                    rowsPerPageOptions,
                    customToolbar: () => (
                        <FilterResetButton
                            handleClick={() => {
                            filterManager.resetFilter()
                            }}
                        />
                    ),
                    onSearchChange: (value) => filterManager.changeSearch(value),
                    onChangePage:(page) => filterManager.changePage(page),
                    onChangeRowsPerPage:(perPage) => filterManager.changeRowsPerPage(perPage),
                    onColumnSortChange: (changedColumn: string, direction: string) => filterManager.changeColumnSort(changedColumn, direction),
                    onRowsDelete: (rowsDeleted: any[]) => {
                        setRowsToDelete(rowsDeleted as any)
                        return false
                    }
                }}
            />
        </>
    )
}

export default Table